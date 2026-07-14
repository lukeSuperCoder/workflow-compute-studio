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

package mirapmmsiextractor

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/infra/coderunner"
	"github.com/coze-dev/coze-studio/backend/infra/coderunner/impl/direct"
)

type fakeCodeRunner struct {
	request  *coderunner.RunRequest
	response *coderunner.RunResponse
	err      error
}

func (f *fakeCodeRunner) Run(_ context.Context, request *coderunner.RunRequest) (*coderunner.RunResponse, error) {
	f.request = request
	return f.response, f.err
}

func withCodeRunner(t *testing.T, runner coderunner.Runner) {
	t.Helper()
	previous := coderunner.GetCodeRunner()
	coderunner.SetCodeRunner(runner)
	t.Cleanup(func() { coderunner.SetCodeRunner(previous) })
}

func TestRunnerInvokesFixedPythonCode(t *testing.T) {
	fake := &fakeCodeRunner{response: &coderunner.RunResponse{Result: map[string]any{"mmsis": "2,1,3"}}}
	withCodeRunner(t, fake)
	runner := &Runner{inputNames: []string{"dataset_1", "dataset_2"}}
	input := map[string]any{
		"dataset_1": []any{map[string]any{"mmsi": 2}, map[string]any{"mmsi": " 1 "}},
		"dataset_2": []any{map[string]any{"mmsi": "1"}, map[string]any{"mmsi": 3}},
	}

	got, err := runner.Invoke(context.Background(), input)
	if err != nil {
		t.Fatalf("Invoke() error = %v", err)
	}
	if got["mmsis"] != "2,1,3" {
		t.Fatalf("Invoke() mmsis = %#v", got["mmsis"])
	}
	if fake.request == nil || fake.request.Language != coderunner.Python {
		t.Fatalf("unexpected coderunner request: %#v", fake.request)
	}
	if !strings.Contains(fake.request.Code, `",".join(values)`) {
		t.Fatalf("fixed code does not join MMSI values: %s", fake.request.Code)
	}
}

func TestConfigAdaptBackfillsArrayInputsFromCanvasEdges(t *testing.T) {
	source := &vo.Node{
		ID: "upstream-1",
		Data: &vo.Data{Outputs: []any{&vo.Variable{
			Name:   "ships",
			Type:   vo.VariableTypeList,
			Schema: &vo.Variable{Type: vo.VariableTypeObject},
		}}},
	}
	target := &vo.Node{
		ID: "extractor-1",
		Data: &vo.Data{
			Meta:    &vo.NodeMetaFE{Title: "提取 MMSI 集合"},
			Inputs:  &vo.Inputs{InputParameters: []*vo.Param{}},
			Outputs: []any{&vo.Variable{Name: "mmsis", Type: vo.VariableTypeString}},
		},
	}
	canvas := &vo.Canvas{
		Nodes: []*vo.Node{source, target},
		Edges: []*vo.Edge{{SourceNodeID: source.ID, TargetNodeID: target.ID}},
	}
	config := &Config{}

	_, err := config.Adapt(context.Background(), target, nodes.WithCanvas(canvas))
	if err != nil {
		t.Fatalf("Adapt() error = %v", err)
	}
	if len(config.InputNames) != 1 || config.InputNames[0] != "dataset_1" {
		t.Fatalf("InputNames = %#v", config.InputNames)
	}
	if len(target.Data.Inputs.InputParameters) != 1 {
		t.Fatalf("input parameters = %#v", target.Data.Inputs.InputParameters)
	}
}

func TestRunnerExtractsNormalizesAndDeduplicatesMMSI(t *testing.T) {
	withCodeRunner(t, direct.NewRunner())
	runner := &Runner{inputNames: []string{"dataset_1", "dataset_2"}}
	input := map[string]any{
		"dataset_1": []any{
			map[string]any{"mmsi": 2},
			map[string]any{"mmsi": " 1 "},
			map[string]any{"mmsi": true},
			"not-an-object",
		},
		"dataset_2": []any{
			map[string]any{"mmsi": "1"},
			map[string]any{"mmsi": "00123"},
			map[string]any{"mmsi": 123},
			map[string]any{"mmsi": nil},
		},
	}

	got, err := runner.Invoke(context.Background(), input)
	if err != nil {
		t.Fatalf("Invoke() error = %v", err)
	}
	if got["mmsis"] != "2,1,00123,123" {
		t.Fatalf("Invoke() mmsis = %#v", got["mmsis"])
	}
}

func TestRunnerRejectsNonArrayInput(t *testing.T) {
	withCodeRunner(t, &fakeCodeRunner{})
	runner := &Runner{inputNames: []string{"dataset_1"}}
	_, err := runner.Invoke(context.Background(), map[string]any{"dataset_1": "not-an-array"})
	if err == nil || !strings.Contains(err.Error(), "dataset_1 must be an array") {
		t.Fatalf("Invoke() error = %v", err)
	}
}

func TestRunnerPropagatesCodeRunnerFailure(t *testing.T) {
	withCodeRunner(t, &fakeCodeRunner{err: errors.New("sandbox failed")})
	runner := &Runner{inputNames: []string{"dataset_1"}}
	_, err := runner.Invoke(context.Background(), map[string]any{"dataset_1": []any{}})
	if err == nil || !strings.Contains(err.Error(), "sandbox failed") {
		t.Fatalf("Invoke() error = %v", err)
	}
}

func TestRunnerRejectsMalformedCodeRunnerResult(t *testing.T) {
	withCodeRunner(t, &fakeCodeRunner{response: &coderunner.RunResponse{Result: map[string]any{"mmsis": []any{}}}})
	runner := &Runner{inputNames: []string{"dataset_1"}}
	_, err := runner.Invoke(context.Background(), map[string]any{"dataset_1": []any{}})
	if err == nil || !strings.Contains(err.Error(), "mmsis must be a string") {
		t.Fatalf("Invoke() error = %v", err)
	}
}

func TestRunnerRejectsMissingCodeRunner(t *testing.T) {
	withCodeRunner(t, nil)
	runner := &Runner{inputNames: []string{"dataset_1"}}
	_, err := runner.Invoke(context.Background(), map[string]any{"dataset_1": []any{}})
	if err == nil || !strings.Contains(err.Error(), "code runner is not initialized") {
		t.Fatalf("Invoke() error = %v", err)
	}
}
