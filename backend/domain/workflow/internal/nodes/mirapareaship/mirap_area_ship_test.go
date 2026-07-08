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
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

		_, _ = w.Write([]byte(`{"code":"200","message":"success","datas":[{"mmsi":371836000,"enName":"MOL ENDOWMENT","age":20.0,"countrycode":"PA","shipType":"集装箱船","length":294.12,"width":32.2,"dwt":62949,"tradetype":"foreign"}],"count":0}`))
	}))
	defer server.Close()

	extractor := &Extractor{
		client:      server.Client(),
		endpointURL: server.URL,
	}

	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputPoints:    "124 30.4,124.1 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
	})

	require.NoError(t, err)
	ships, ok := output[outputShips].([]any)
	require.True(t, ok)
	require.Len(t, ships, 1)
	first, ok := ships[0].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, int64(371836000), first["mmsi"])
	assert.Equal(t, "MOL ENDOWMENT", first["enName"])
	assert.Equal(t, 20.0, first["age"])
	assert.Equal(t, "PA", first["countrycode"])
	assert.Equal(t, "集装箱船", first["shipType"])
	assert.Equal(t, 294.12, first["length"])
	assert.Equal(t, 32.2, first["width"])
	assert.Equal(t, int64(62949), first["dwt"])
	assert.Equal(t, "foreign", first["tradetype"])
	// the fixed single-output contract must not leak other fields
	assert.Len(t, output, 1)
}

func TestExtractorInvokeRequiresAuthorization(t *testing.T) {
	extractor := &Extractor{client: http.DefaultClient, endpointURL: "http://example.invalid"}

	output, err := extractor.Invoke(context.Background(), map[string]any{
		inputPoints:    "124 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
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
		inputPoints:    "124 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
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
		inputPoints:    "124 30.4",
		inputStartDate: "2026-07-04",
		inputEndDate:   "2026-07-06",
	})

	require.NoError(t, err)
	assert.Equal(t, []any{}, output[outputShips])
}
