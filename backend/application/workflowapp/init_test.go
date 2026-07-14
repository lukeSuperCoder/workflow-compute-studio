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

package workflowapp

import (
	"context"
	"testing"

	"github.com/coze-dev/coze-studio/backend/infra/coderunner"
)

func TestNewWorkflowCodeRunnerExecutesFixedPython(t *testing.T) {
	runner := newWorkflowCodeRunner()
	if runner == nil {
		t.Fatal("newWorkflowCodeRunner() returned nil")
	}
	response, err := runner.Run(context.Background(), &coderunner.RunRequest{
		Language: coderunner.Python,
		Code:     "async def main(args):\n    return {\"value\": args.params[\"value\"]}",
		Params:   map[string]any{"value": "ok"},
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if response.Result["value"] != "ok" {
		t.Fatalf("Run() result = %#v", response.Result)
	}
}
