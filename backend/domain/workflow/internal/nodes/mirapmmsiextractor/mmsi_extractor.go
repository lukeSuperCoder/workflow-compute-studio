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
	"fmt"
	"reflect"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
	"github.com/coze-dev/coze-studio/backend/infra/coderunner"
)

const fixedPythonCode = `async def main(args):
    seen = set()
    values = []
    for name in sorted(args.params.keys(), key=lambda value: int(value.split('_')[-1])):
        dataset = args.params[name]
        if not isinstance(dataset, list):
            raise TypeError(f"{name} must be an array")
        for item in dataset:
            if not isinstance(item, dict):
                continue
            value = item.get("mmsi")
            if isinstance(value, bool) or not isinstance(value, (str, int, float)):
                continue
            normalized = str(value).strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            values.append(normalized)
    return {"mmsis": ",".join(values)}
`

type Config struct {
	InputNames []string `json:"inputNames,omitempty"`
}

func (c *Config) Adapt(_ context.Context, n *vo.Node, _ ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{
		Key:     vo.NodeKey(n.ID),
		Type:    entity.NodeTypeMirapMMSIExtractor,
		Name:    n.Data.Meta.Title,
		Configs: c,
	}
	c.InputNames = c.InputNames[:0]
	if n.Data == nil || n.Data.Inputs == nil || len(n.Data.Inputs.InputParameters) == 0 {
		return nil, fmt.Errorf("at least one input result set is required")
	}
	for _, parameter := range n.Data.Inputs.InputParameters {
		if parameter != nil && parameter.Name != "" {
			c.InputNames = append(c.InputNames, parameter.Name)
		}
	}
	if err := convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}
	if err := convert.SetOutputTypesForNodeSchema(n, ns); err != nil {
		return nil, err
	}
	return ns, nil
}

func (c *Config) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	return &Runner{inputNames: append([]string(nil), c.InputNames...)}, nil
}

type Runner struct {
	inputNames []string
}

func (r *Runner) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
	if len(r.inputNames) == 0 {
		return nil, fmt.Errorf("at least one input result set is required")
	}
	params := make(map[string]any, len(r.inputNames))
	for _, name := range r.inputNames {
		value := input[name]
		kind := reflect.Invalid
		if value != nil {
			kind = reflect.TypeOf(value).Kind()
		}
		if kind != reflect.Slice && kind != reflect.Array {
			return nil, fmt.Errorf("%s must be an array", name)
		}
		params[name] = value
	}

	codeRunner := coderunner.GetCodeRunner()
	if codeRunner == nil {
		return nil, fmt.Errorf("code runner is not initialized")
	}
	response, err := codeRunner.Run(ctx, &coderunner.RunRequest{
		Code:     fixedPythonCode,
		Params:   params,
		Language: coderunner.Python,
	})
	if err != nil {
		return nil, fmt.Errorf("execute MMSI extractor code: %w", err)
	}
	if response == nil {
		return nil, fmt.Errorf("MMSI extractor code returned no result")
	}
	mmsis, ok := response.Result["mmsis"].(string)
	if !ok {
		return nil, fmt.Errorf("MMSI extractor result mmsis must be a string")
	}
	return map[string]any{"mmsis": mmsis}, nil
}
