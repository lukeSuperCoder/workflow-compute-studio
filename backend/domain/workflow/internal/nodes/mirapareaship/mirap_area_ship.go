/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package mirapareaship

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
)

const (
	authorizationEnv = "MIRAP_AREA_SHIP_AUTHORIZATION"

	inputPoints    = "points"
	inputStartDate = "startdate"
	inputEndDate   = "enddate"

	// The node exposes a single fixed output: the ship list (Array<Object>),
	// whose element carries the fields under the API response's `datas`.
	outputShips = "ships"
)

var endpointURL = "https://mirap-test.elane.com/api/bigData/external_unifiedapi/getMmsiByAreawholeWorld"

type Config struct {
	EndpointURL string `json:"endpoint_url,omitempty"`
}

func (c *Config) Adapt(_ context.Context, n *vo.Node, _ ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{
		Key:     vo.NodeKey(n.ID),
		Type:    entity.NodeTypeMirapAreaShipExtractor,
		Name:    n.Data.Meta.Title,
		Configs: c,
	}

	if err := convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	c.EndpointURL = endpointURL
	ns.SetOutputType(outputShips, shipsOutputType())

	return ns, nil
}

func (c *Config) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	url := c.EndpointURL
	if url == "" {
		url = endpointURL
	}
	return &Extractor{
		client:      &http.Client{Timeout: 120 * time.Second},
		endpointURL: url,
	}, nil
}

type Extractor struct {
	client      *http.Client
	endpointURL string
}

type requestBody struct {
	Points    string `json:"points"`
	StartDate string `json:"startdate"`
	EndDate   string `json:"enddate"`
}

type responseBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Datas   []ship `json:"datas"`
	Count   int64  `json:"count"`
}

type ship struct {
	MMSI        int64   `json:"mmsi"`
	EnName      string  `json:"enName"`
	Age         float64 `json:"age"`
	CountryCode string  `json:"countrycode"`
	ShipType    string  `json:"shipType"`
	Length      float64 `json:"length"`
	Width       float64 `json:"width"`
	DWT         int64   `json:"dwt"`
	TradeType   string  `json:"tradetype"`
}

func (e *Extractor) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
	auth := os.Getenv(authorizationEnv)
	if auth == "" {
		return nil, fmt.Errorf("%s is required", authorizationEnv)
	}

	payload := requestBody{
		Points:    stringInput(input, inputPoints),
		StartDate: stringInput(input, inputStartDate),
		EndDate:   stringInput(input, inputEndDate),
	}
	if payload.Points == "" || payload.StartDate == "" || payload.EndDate == "" {
		return nil, fmt.Errorf("points, startdate and enddate are required")
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.endpointURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("accept", "application/json, text/plain, */*")
	req.Header.Set("authorization", auth)

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("request %s failed, response status code=%d, body=%s", e.endpointURL, resp.StatusCode, string(rawBody))
	}

	var parsed responseBody
	if err := json.Unmarshal(rawBody, &parsed); err != nil {
		return nil, fmt.Errorf("parse mirap area ship response failed: %w", err)
	}
	if parsed.Code != "200" {
		return nil, fmt.Errorf("mirap area ship api failed, code=%s, message=%s", parsed.Code, parsed.Message)
	}

	// The workflow engine (compose.FillIfNotRequired) requires an Array output
	// to be []any with map[string]any elements when the element type declares
	// properties. Convert the typed []ship accordingly, preserving the declared
	// field types (int64 for integers, float64 for numbers).
	shipsOut := make([]any, 0, len(parsed.Datas))
	for i := range parsed.Datas {
		shipsOut = append(shipsOut, parsed.Datas[i].toMap())
	}

	return map[string]any{
		outputShips: shipsOut,
	}, nil
}

func stringInput(input map[string]any, key string) string {
	if value, ok := input[key].(string); ok {
		return value
	}
	return ""
}

// toMap renders a ship record as a generic map so the workflow engine can
// treat the ships output as []any of map[string]any.
func (s ship) toMap() map[string]any {
	return map[string]any{
		"mmsi":        s.MMSI,
		"enName":      s.EnName,
		"age":         s.Age,
		"countrycode": s.CountryCode,
		"shipType":    s.ShipType,
		"length":      s.Length,
		"width":       s.Width,
		"dwt":         s.DWT,
		"tradetype":   s.TradeType,
	}
}

// shipsOutputType describes the fixed `ships` output: Array<Object> whose
// element carries the fields under the API response's `datas`.
func shipsOutputType() *vo.TypeInfo {
	return &vo.TypeInfo{
		Type: vo.DataTypeArray,
		ElemTypeInfo: &vo.TypeInfo{
			Type: vo.DataTypeObject,
			Properties: map[string]*vo.TypeInfo{
				"mmsi":        {Type: vo.DataTypeInteger},
				"enName":      {Type: vo.DataTypeString},
				"age":         {Type: vo.DataTypeNumber},
				"countrycode": {Type: vo.DataTypeString},
				"shipType":    {Type: vo.DataTypeString},
				"length":      {Type: vo.DataTypeNumber},
				"width":       {Type: vo.DataTypeNumber},
				"dwt":         {Type: vo.DataTypeInteger},
				"tradetype":   {Type: vo.DataTypeString},
			},
		},
	}
}
