/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0
 */

// Package miraphttpapi implements the declaration-driven MIRAP HTTP operators.
// Each API remains a distinct persisted workflow node while sharing transport,
// validation, and response-shaping behavior.
package miraphttpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
)

const defaultBaseURL = "https://mirap-test.elane.com"

type Field struct {
	Name       string
	SourceName string
	Type       vo.DataType
	Required   bool
	Children   []Field
}

type Spec struct {
	NodeType entity.NodeType
	Method   string
	Path     string
	Inputs   []Field
	Outputs  []Field
}

type Config struct {
	Spec        Spec   `json:"-"`
	EndpointURL string `json:"endpoint_url,omitempty"`
}

func NewConfig(spec Spec) *Config { return &Config{Spec: spec} }

func (c *Config) Adapt(_ context.Context, n *vo.Node, _ ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{Key: vo.NodeKey(n.ID), Type: c.Spec.NodeType, Name: n.Data.Meta.Title, Configs: c}
	if err := convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}
	c.EndpointURL = endpointURL(c.Spec.Path)
	for _, field := range c.Spec.Outputs {
		ns.SetOutputType(field.Name, typeInfo(field))
	}
	return ns, nil
}

func (c *Config) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	endpoint := c.EndpointURL
	if endpoint == "" {
		endpoint = endpointURL(c.Spec.Path)
	}
	return &Runner{client: &http.Client{Timeout: 120 * time.Second}, endpointURL: endpoint, spec: c.Spec}, nil
}

func endpointURL(path string) string {
	base := strings.TrimRight(os.Getenv("MIRAP_BASE_URL"), "/")
	if base == "" {
		base = defaultBaseURL
	}
	return base + path
}

type Runner struct {
	client      *http.Client
	endpointURL string
	spec        Spec
}

func (r *Runner) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
	payload := make(map[string]any, len(r.spec.Inputs))
	for _, field := range r.spec.Inputs {
		value, ok := input[field.Name]
		if !ok || isEmpty(value) {
			if field.Required {
				return nil, fmt.Errorf("%s is required", field.Name)
			}
			continue
		}
		payload[field.Name] = value
	}

	method := r.spec.Method
	if method == "" {
		method = http.MethodPost
	}
	endpoint := r.endpointURL
	var body io.Reader
	if method == http.MethodGet {
		query := url.Values{}
		for key, value := range payload {
			query.Set(key, fmt.Sprint(value))
		}
		endpoint += "?" + query.Encode()
	} else {
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("accept", "application/json, text/plain, */*")
	if method != http.MethodGet {
		req.Header.Set("content-type", "application/json")
	}
	if auth := os.Getenv("MIRAP_AUTHORIZATION"); auth != "" {
		req.Header.Set("authorization", auth)
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("request %s failed, response status code=%d, body=%s", endpoint, resp.StatusCode, raw)
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("parse MIRAP response failed: %w", err)
	}
	if code, ok := parsed["code"].(string); ok && code != "200" {
		return nil, fmt.Errorf("MIRAP API failed, code=%s, message=%v", code, parsed["message"])
	}
	out := make(map[string]any, len(r.spec.Outputs))
	for _, field := range r.spec.Outputs {
		out[field.Name] = shapeValue(parsed[sourceName(field)], field)
	}
	return out, nil
}

func isEmpty(v any) bool {
	if v == nil {
		return true
	}
	s, ok := v.(string)
	return ok && strings.TrimSpace(s) == ""
}
func sourceName(f Field) string {
	if f.SourceName != "" {
		return f.SourceName
	}
	return f.Name
}
func shapeValue(value any, field Field) any {
	if len(field.Children) == 0 {
		return value
	}
	if items, ok := value.([]any); ok {
		out := make([]any, 0, len(items))
		for _, item := range items {
			out = append(out, shapeObject(item, field.Children))
		}
		return out
	}
	return shapeObject(value, field.Children)
}
func shapeObject(value any, fields []Field) map[string]any {
	source, _ := value.(map[string]any)
	out := make(map[string]any, len(fields))
	for _, field := range fields {
		out[field.Name] = shapeValue(source[sourceName(field)], field)
	}
	return out
}
func typeInfo(field Field) *vo.TypeInfo {
	if len(field.Children) == 0 {
		return &vo.TypeInfo{Type: field.Type}
	}
	props := make(map[string]*vo.TypeInfo, len(field.Children))
	for _, child := range field.Children {
		props[child.Name] = typeInfo(child)
	}
	if field.Type == vo.DataTypeArray {
		return &vo.TypeInfo{Type: vo.DataTypeArray, ElemTypeInfo: &vo.TypeInfo{Type: vo.DataTypeObject, Properties: props}}
	}
	return &vo.TypeInfo{Type: vo.DataTypeObject, Properties: props}
}

var mmsiOutputs = []Field{{Name: "code", Type: vo.DataTypeString}, {Name: "message", Type: vo.DataTypeString}, {Name: "datas", Type: vo.DataTypeArray, Children: []Field{{Name: "mmsi", Type: vo.DataTypeInteger}}}, {Name: "count", Type: vo.DataTypeInteger}}

func in(name string, typ vo.DataType, required bool) Field {
	return Field{Name: name, Type: typ, Required: required}
}
func data(fields ...Field) []Field {
	return []Field{{Name: "datas", Type: vo.DataTypeArray, Children: fields}}
}
func f(name string, typ vo.DataType) Field { return Field{Name: name, Type: typ} }
func alias(name, source string, typ vo.DataType) Field {
	return Field{Name: name, SourceName: source, Type: typ}
}

var Specs = []Spec{
	{entity.NodeTypeMirapBogusFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByBoguswholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true)}, mmsiOutputs},
	{entity.NodeTypeMirapBogusDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getBogusDetailwholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("points", vo.DataTypeString, false)}, data(f("shipId", vo.DataTypeInteger), f("mmsi", vo.DataTypeInteger), alias("dateKey", "datekey", vo.DataTypeString), f("lon", vo.DataTypeNumber), f("lat", vo.DataTypeNumber))},
	{entity.NodeTypeMirapHoverFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByHoverwholeWorld", []Field{in("mmsi", vo.DataTypeString, false), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minhour", vo.DataTypeInteger, false), in("maxhour", vo.DataTypeInteger, false), in("points", vo.DataTypeString, false)}, mmsiOutputs},
	{entity.NodeTypeMirapHoverEventDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getHoverDetailwholeWorld", []Field{in("mmsi", vo.DataTypeString, false), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("points", vo.DataTypeString, false)}, data(f("shipId", vo.DataTypeInteger), f("mmsi", vo.DataTypeInteger), f("beginTime", vo.DataTypeInteger), f("endTime", vo.DataTypeInteger), f("beginLon", vo.DataTypeNumber), f("beginLat", vo.DataTypeNumber), f("endLon", vo.DataTypeNumber), f("endLat", vo.DataTypeNumber), f("duration", vo.DataTypeNumber))},
	{entity.NodeTypeMirapLeanFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getShipDockEventFilterwholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("bymmsi", vo.DataTypeString, false), in("begin_time", vo.DataTypeString, true), in("end_time", vo.DataTypeString, true), in("minhour", vo.DataTypeInteger, true), in("maxhour", vo.DataTypeInteger, true), in("points", vo.DataTypeString, false), in("vesselcategory", vo.DataTypeString, false)}, mmsiOutputs},
	{entity.NodeTypeMirapLeanDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getShipDockDetailwholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("bymmsi_name", vo.DataTypeString, false), in("begin_time", vo.DataTypeString, true), in("end_time", vo.DataTypeString, true), in("points", vo.DataTypeString, false)}, data(f("shipId", vo.DataTypeInteger), f("mmsi", vo.DataTypeInteger), alias("beginTime", "btime", vo.DataTypeInteger), alias("endTime", "etime", vo.DataTypeInteger), alias("beginLon", "blon", vo.DataTypeNumber), alias("beginLat", "blat", vo.DataTypeNumber), alias("endLon", "elon", vo.DataTypeNumber), alias("endLat", "elat", vo.DataTypeNumber), f("duration", vo.DataTypeNumber), f("enName", vo.DataTypeString), f("shipIdBy", vo.DataTypeInteger), alias("mmsiBy", "bymmsi", vo.DataTypeInteger), alias("enNameBy", "bymmsi_name", vo.DataTypeString), f("dwt", vo.DataTypeInteger), f("shipType", vo.DataTypeString), f("length", vo.DataTypeNumber), f("width", vo.DataTypeNumber), f("age", vo.DataTypeNumber))},
	{entity.NodeTypeMirapRemainFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByRemainwholeWorld", []Field{in("mmsi", vo.DataTypeString, false), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minhour", vo.DataTypeInteger, true), in("maxhour", vo.DataTypeInteger, true), in("points", vo.DataTypeString, false)}, mmsiOutputs},
	{entity.NodeTypeMirapRemainDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getRemainDetailwholeWorld", []Field{in("mmsi", vo.DataTypeString, false), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("points", vo.DataTypeString, false)}, data(f("shipId", vo.DataTypeInteger), f("mmsi", vo.DataTypeInteger), f("beginTime", vo.DataTypeInteger), f("endTime", vo.DataTypeInteger), f("beginLon", vo.DataTypeNumber), f("beginLat", vo.DataTypeNumber), f("endLon", vo.DataTypeNumber), f("endLat", vo.DataTypeNumber), f("duration", vo.DataTypeNumber), f("beginPortId", vo.DataTypeInteger), f("endPortId", vo.DataTypeInteger))},
	{entity.NodeTypeMirapRetraceFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByRetracewholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minvalue", vo.DataTypeInteger, true), in("maxvalue", vo.DataTypeInteger, true), in("points", vo.DataTypeString, false)}, mmsiOutputs},
	{entity.NodeTypeMirapSignalSpoofingDetail, http.MethodPost, "/api/elaneDataOpenApi/feign/external_unifiedapi/getSignalSpoofingInfowholeWorld", []Field{in("mmsi", vo.DataTypeString, true), in("starttime", vo.DataTypeInteger, true), in("endtime", vo.DataTypeInteger, true)}, data(f("mmsi", vo.DataTypeInteger), alias("utcBegin", "utc_begin", vo.DataTypeInteger), alias("utcEnd", "utc_end", vo.DataTypeInteger))},
	{entity.NodeTypeMirapFakeSignalRecover, http.MethodGet, "/external_unifiedapi/getfakesignalsrecover", []Field{in("mmsi", vo.DataTypeString, true)}, data(f("mmsi", vo.DataTypeInteger), alias("realTime", "real_time", vo.DataTypeString), alias("realLon", "real_lon", vo.DataTypeNumber), alias("realLat", "real_lat", vo.DataTypeNumber))},
	{entity.NodeTypeMirapTrajectoryQuality, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByTrajectorywholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minvalue", vo.DataTypeNumber, true), in("maxvalue", vo.DataTypeNumber, true), in("mmsi", vo.DataTypeString, true)}, mmsiOutputs},
	{entity.NodeTypeMirapInterruptFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByInterruptwholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minhour", vo.DataTypeInteger, true), in("maxhour", vo.DataTypeInteger, true), in("mmsi", vo.DataTypeString, false), in("points", vo.DataTypeString, false), in("sog_ratio", vo.DataTypeNumber, false)}, mmsiOutputs},
	{entity.NodeTypeMirapRepetitionFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByRepetitionwholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minhour", vo.DataTypeInteger, true), in("maxhour", vo.DataTypeInteger, true), in("mmsi", vo.DataTypeString, false), in("points", vo.DataTypeString, false), in("sog_ratio", vo.DataTypeNumber, false)}, mmsiOutputs},
	{entity.NodeTypeMirapInterruptDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getInterruptDetailwholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("mmsi", vo.DataTypeString, false), in("points", vo.DataTypeString, false), in("sog_ratio", vo.DataTypeNumber, false)}, data(f("mmsi", vo.DataTypeInteger), f("beginTime", vo.DataTypeInteger), f("endTime", vo.DataTypeInteger), f("beginLon", vo.DataTypeNumber), f("beginLat", vo.DataTypeNumber), f("endLon", vo.DataTypeNumber), f("endLat", vo.DataTypeNumber), f("distGap", vo.DataTypeNumber), f("speedGap", vo.DataTypeNumber), f("duration", vo.DataTypeNumber))},
	{entity.NodeTypeMirapLowVelocityDetail, http.MethodPost, "/api/bigData/external_unifiedapi/getLowVelocityDetailwholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("mmsi", vo.DataTypeString, true), in("points", vo.DataTypeString, false)}, data(f("mmsi", vo.DataTypeInteger), f("beginTime", vo.DataTypeInteger), f("endTime", vo.DataTypeInteger), f("beginLon", vo.DataTypeNumber), f("beginLat", vo.DataTypeNumber), f("endLon", vo.DataTypeNumber), f("endLat", vo.DataTypeNumber), f("beginPortId", vo.DataTypeInteger), f("endPortId", vo.DataTypeInteger), f("duration", vo.DataTypeNumber))},
	{entity.NodeTypeMirapSpeedFilter, http.MethodPost, "/api/bigData/external_unifiedapi/trackminmaxSpeedMmsiwholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("endDate", vo.DataTypeString, true), in("mmsi", vo.DataTypeString, false), in("minknot", vo.DataTypeInteger, true), in("maxknot", vo.DataTypeInteger, true), in("points", vo.DataTypeString, false)}, mmsiOutputs},
	{entity.NodeTypeMirapNoRegularFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByNoRegularwholeWorld", []Field{in("mmsi", vo.DataTypeString, true)}, mmsiOutputs},
	{entity.NodeTypeMirapOnlineRatioFilter, http.MethodPost, "/api/bigData/external_unifiedapi/getMmsiByOnlineRatiowholeWorld", []Field{in("startdate", vo.DataTypeString, true), in("enddate", vo.DataTypeString, true), in("minvalue", vo.DataTypeNumber, true), in("maxvalue", vo.DataTypeNumber, true), in("mmsi", vo.DataTypeString, true)}, mmsiOutputs},
}
