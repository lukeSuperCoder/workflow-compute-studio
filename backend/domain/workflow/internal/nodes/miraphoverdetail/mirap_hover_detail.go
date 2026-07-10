/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package miraphoverdetail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
)

const (
	authorizationEnv = "MIRAP_AUTHORIZATION"
	baseURLEnv       = "MIRAP_BASE_URL"

	inputAreaPoints = "area_points"
	inputStartDate  = "start_date"
	inputEndDate    = "end_date"

	outputTurnbackEventDetails = "turnback_event_details"
	endpointPath               = "/api/bigData/external_unifiedapi/getHoverDetailwholeWorld"
)

const defaultBaseURL = "https://mirap-test.elane.com"

type Config struct {
	EndpointURL string `json:"endpoint_url,omitempty"`
}

func (c *Config) Adapt(_ context.Context, n *vo.Node, _ ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{
		Key:     vo.NodeKey(n.ID),
		Type:    entity.NodeTypeMirapHoverDetail,
		Name:    n.Data.Meta.Title,
		Configs: c,
	}

	if err := convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	c.EndpointURL = endpointURL()
	ns.SetOutputType(outputTurnbackEventDetails, &vo.TypeInfo{
		Type: vo.DataTypeArray,
		ElemTypeInfo: &vo.TypeInfo{
			Type: vo.DataTypeObject,
			Properties: map[string]*vo.TypeInfo{
				"mmsi":      {Type: vo.DataTypeInteger},
				"beginTime": {Type: vo.DataTypeInteger},
				"endTime":   {Type: vo.DataTypeInteger},
				"beginLon":  {Type: vo.DataTypeNumber},
				"beginLat":  {Type: vo.DataTypeNumber},
				"endLon":    {Type: vo.DataTypeNumber},
				"endLat":    {Type: vo.DataTypeNumber},
				"duration":  {Type: vo.DataTypeNumber},
			},
		},
	})

	return ns, nil
}

func (c *Config) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	url := c.EndpointURL
	if url == "" {
		url = endpointURL()
	}
	return &Extractor{
		client:      &http.Client{Timeout: 120 * time.Second},
		endpointURL: url,
	}, nil
}

func endpointURL() string {
	baseURL := strings.TrimRight(os.Getenv(baseURLEnv), "/")
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return baseURL + endpointPath
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
	Code    string                `json:"code"`
	Message string                `json:"message"`
	Datas   []turnbackEventDetail `json:"datas"`
	Count   int64                 `json:"count"`
}

type turnbackEventDetail struct {
	MMSI      int64   `json:"mmsi"`
	BeginTime int64   `json:"beginTime"`
	EndTime   int64   `json:"endTime"`
	BeginLon  float64 `json:"beginLon"`
	BeginLat  float64 `json:"beginLat"`
	EndLon    float64 `json:"endLon"`
	EndLat    float64 `json:"endLat"`
	Duration  float64 `json:"duration"`
}

func (e *Extractor) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
	auth := os.Getenv(authorizationEnv)
	if auth == "" {
		return nil, fmt.Errorf("%s is required", authorizationEnv)
	}

	payload := requestBody{
		Points:    stringInput(input, inputAreaPoints, "points"),
		StartDate: stringInput(input, inputStartDate, "startdate"),
		EndDate:   stringInput(input, inputEndDate, "enddate"),
	}
	if payload.Points == "" || payload.StartDate == "" || payload.EndDate == "" {
		return nil, fmt.Errorf("area_points, start_date and end_date are required")
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
		return nil, fmt.Errorf("parse mirap hover detail response failed: %w", err)
	}
	if parsed.Code != "200" {
		return nil, fmt.Errorf("mirap hover detail api failed, code=%s, message=%s", parsed.Code, parsed.Message)
	}

	details := make([]any, 0, len(parsed.Datas))
	for i := range parsed.Datas {
		detail := parsed.Datas[i]
		details = append(details, map[string]any{
			"mmsi":      detail.MMSI,
			"beginTime": detail.BeginTime,
			"endTime":   detail.EndTime,
			"beginLon":  detail.BeginLon,
			"beginLat":  detail.BeginLat,
			"endLon":    detail.EndLon,
			"endLat":    detail.EndLat,
			"duration":  detail.Duration,
		})
	}

	return map[string]any{
		outputTurnbackEventDetails: details,
	}, nil
}

func stringInput(input map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := input[key].(string); ok {
			return value
		}
	}
	return ""
}
