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

package miraphoverdetail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractorInvokeSuccess(t *testing.T) {
	t.Setenv(authorizationEnv, "elane_token_test")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("content-type"))
		assert.Equal(t, "elane_token_test", r.Header.Get("authorization"))

		var req requestBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "124 30.4,124.1 30.4", req.Points)
		assert.Equal(t, "2026-07-04", req.StartDate)
		assert.Equal(t, "2026-07-06", req.EndDate)

		_, _ = w.Write([]byte(`{"code":"200","message":"success","datas":[{"mmsi":538012836,"beginTime":1727368251,"endTime":1783267199,"beginLon":124.264933,"beginLat":30.622615,"endLon":0.0,"endLat":0.0,"duration":15527.0},{"mmsi":636093055,"beginTime":1734517223,"endTime":1783267199,"beginLon":124.17968,"beginLat":30.461965,"endLon":0.0,"endLat":0.0,"duration":13542.0}],"count":0}`))
	}))
	defer server.Close()

	extractor := &Extractor{
		client:      server.Client(),
		endpointURL: server.URL,
	}

	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputAreaPoints: "124 30.4,124.1 30.4",
		inputStartDate:  "2026-07-04",
		inputEndDate:    "2026-07-06",
	})

	require.NoError(t, err)
	events, ok := output[outputTurnbackEventDetails].([]any)
	require.True(t, ok)
	assert.Equal(t, []any{
		map[string]any{
			"mmsi":      int64(538012836),
			"beginTime": int64(1727368251),
			"endTime":   int64(1783267199),
			"beginLon":  124.264933,
			"beginLat":  30.622615,
			"endLon":    0.0,
			"endLat":    0.0,
			"duration":  15527.0,
		},
		map[string]any{
			"mmsi":      int64(636093055),
			"beginTime": int64(1734517223),
			"endTime":   int64(1783267199),
			"beginLon":  124.17968,
			"beginLat":  30.461965,
			"endLon":    0.0,
			"endLat":    0.0,
			"duration":  13542.0,
		},
	}, events)
	assert.Len(t, output, 1)
}

func TestExtractorInvokeSelectedOutputsSubset(t *testing.T) {
	t.Setenv(authorizationEnv, "elane_token_test")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"code":"200","message":"success","datas":[{"mmsi":538012836,"beginTime":1727368251,"endTime":1783267199,"beginLon":124.264933,"beginLat":30.622615,"endLon":0.0,"endLat":0.0,"duration":15527.0}]}`))
	}))
	defer server.Close()

	extractor := &Extractor{
		client:          server.Client(),
		endpointURL:     server.URL,
		selectedOutputs: []string{"beginLon"},
	}
	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputAreaPoints: "124 30.4",
		inputStartDate:  "2026-07-04",
		inputEndDate:    "2026-07-06",
	})

	require.NoError(t, err)
	assert.Equal(t, []any{map[string]any{
		"mmsi":     int64(538012836),
		"beginLon": 124.264933,
	}}, output[outputTurnbackEventDetails])
}

func TestDetailOutputTypeUsesSelectedFieldsAndRequiresMMSI(t *testing.T) {
	outputType := detailOutputType([]string{"duration", "unknown"})
	require.NotNil(t, outputType.ElemTypeInfo)
	assert.Equal(t, []string{"duration", "mmsi"}, mapKeys(outputType.ElemTypeInfo.Properties))
}

func TestEndpointURLUsesConfiguredBaseURL(t *testing.T) {
	t.Setenv(baseURLEnv, "https://mirap.example.com/")
	assert.Equal(t, "https://mirap.example.com"+endpointPath, endpointURL())
}

func TestEndpointURLUsesDefaultBaseURL(t *testing.T) {
	t.Setenv(baseURLEnv, "")
	assert.Equal(t, defaultBaseURL+endpointPath, endpointURL())
}

func TestExtractorInvokeSupportsLegacyInputNames(t *testing.T) {
	t.Setenv(authorizationEnv, "elane_token_test")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"code":"200","message":"success","datas":[{"mmsi":371836000,"beginTime":1727368251,"endTime":1783267199,"beginLon":124.264933,"beginLat":30.622615,"endLon":0.0,"endLat":0.0,"duration":15527.0}],"count":0}`))
	}))
	defer server.Close()

	extractor := &Extractor{
		client:      server.Client(),
		endpointURL: server.URL,
	}

	output, err := extractor.Invoke(context.Background(), map[string]any{
		"points":       "124 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
	})

	require.NoError(t, err)
	assert.Equal(t, []any{map[string]any{
		"mmsi":      int64(371836000),
		"beginTime": int64(1727368251),
		"endTime":   int64(1783267199),
		"beginLon":  124.264933,
		"beginLat":  30.622615,
		"endLon":    0.0,
		"endLat":    0.0,
		"duration":  15527.0,
	}}, output[outputTurnbackEventDetails])
}

func TestExtractorInvokeRequiresAuthorization(t *testing.T) {
	extractor := &Extractor{client: http.DefaultClient, endpointURL: "http://example.invalid"}

	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputAreaPoints: "124 30.4",
		inputStartDate:  "2026-07-04",
		inputEndDate:    "2026-07-06",
	})

	require.Error(t, err)
	assert.Nil(t, output)
	assert.Contains(t, err.Error(), authorizationEnv)
}

func TestExtractorInvokeBusinessError(t *testing.T) {
	t.Setenv(authorizationEnv, "elane_token_test")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":"500","message":"failed","datas":[],"count":0}`))
	}))
	defer server.Close()

	extractor := &Extractor{client: server.Client(), endpointURL: server.URL}
	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputAreaPoints: "124 30.4",
		inputStartDate:  "2026-07-04",
		inputEndDate:    "2026-07-06",
	})

	require.Error(t, err)
	assert.Nil(t, output)
	assert.Contains(t, err.Error(), "code=500")
}

func TestExtractorInvokeEmptyDatas(t *testing.T) {
	t.Setenv(authorizationEnv, "elane_token_test")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"code":"200","message":"success","datas":[],"count":0}`))
	}))
	defer server.Close()

	extractor := &Extractor{
		client:      server.Client(),
		endpointURL: server.URL,
	}
	output, err := extractor.Invoke(context.Background(), map[string]any{
		"points":       "124 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
	})

	require.NoError(t, err)
	assert.Equal(t, []any{}, output[outputTurnbackEventDetails])
}

func mapKeys(values map[string]*vo.TypeInfo) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}
