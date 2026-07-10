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

package mirapmmsiset

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/canvas/convert"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
)

const (
	outputResult = "result"

	OpIntersection Operation = "intersection"
	OpUnion        Operation = "union"
	OpDifference   Operation = "difference"
)

type Operation string

type SelectedOutputGroup struct {
	InputName string   `json:"inputName,omitempty"`
	Fields    []string `json:"fields,omitempty"`
}

type Config struct {
	Operation Operation `json:"operation,omitempty"`

	SelectedOutputGroups []SelectedOutputGroup `json:"selectedOutputGroups,omitempty"`
	MainInputName        string                `json:"mainInputName,omitempty"`
}

func NewIntersectionConfig() *Config {
	return &Config{Operation: OpIntersection}
}

func NewUnionConfig() *Config {
	return &Config{Operation: OpUnion}
}

func NewDifferenceConfig() *Config {
	return &Config{Operation: OpDifference}
}

func (c *Config) Adapt(_ context.Context, n *vo.Node, opts ...nodes.AdaptOption) (*schema.NodeSchema, error) {
	ns := &schema.NodeSchema{
		Key:     vo.NodeKey(n.ID),
		Type:    nodeType(c.Operation),
		Name:    n.Data.Meta.Title,
		Configs: c,
	}

	c.SelectedOutputGroups, c.MainInputName = readSetConfig(n)
	if c.Operation == "" {
		c.Operation = operationFromNodeType(ns.Type)
	}

	backfillInputParametersFromCanvas(n, nodes.GetAdaptOptions(opts...).Canvas, c.SelectedOutputGroups)

	if err := convert.SetInputsForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	if err := convert.SetOutputTypesForNodeSchema(n, ns); err != nil {
		return nil, err
	}

	return ns, nil
}

func backfillInputParametersFromCanvas(n *vo.Node, canvas *vo.Canvas, groups []SelectedOutputGroup) {
	if n == nil || n.Data == nil || n.Data.Inputs == nil || len(n.Data.Inputs.InputParameters) > 0 || canvas == nil {
		return
	}

	nodeByID := make(map[string]*vo.Node, len(canvas.Nodes))
	for _, node := range canvas.Nodes {
		if node != nil {
			nodeByID[node.ID] = node
		}
	}

	params := make([]*vo.Param, 0, len(groups))
	for _, edge := range canvas.Edges {
		if edge == nil || edge.TargetNodeID != n.ID {
			continue
		}
		source := nodeByID[edge.SourceNodeID]
		output := firstListOutput(source)
		if output == nil {
			continue
		}

		index := len(params)
		inputName := fmt.Sprintf("dataset_%d", index+1)
		if index < len(groups) && groups[index].InputName != "" {
			inputName = groups[index].InputName
		}
		params = append(params, &vo.Param{
			Name: inputName,
			Input: &vo.BlockInput{
				Type:       output.Type,
				AssistType: output.AssistType,
				Schema:     output.Schema,
				Value: &vo.BlockInputValue{
					Type: vo.BlockInputValueTypeRef,
					Content: &vo.BlockInputReference{
						BlockID: edge.SourceNodeID,
						Name:    output.Name,
						Source:  vo.RefSourceTypeBlockOutput,
					},
				},
			},
		})
	}

	n.Data.Inputs.InputParameters = params
}

func firstListOutput(n *vo.Node) *vo.Variable {
	if n == nil || n.Data == nil {
		return nil
	}

	var fallback *vo.Variable
	for _, outputAny := range n.Data.Outputs {
		output, err := vo.ParseVariable(outputAny)
		if err != nil || output == nil || output.Type != vo.VariableTypeList {
			continue
		}
		if output.Name == "ships" {
			return output
		}
		if fallback == nil {
			fallback = output
		}
	}
	return fallback
}

func (c *Config) Build(_ context.Context, _ *schema.NodeSchema, _ ...schema.BuildOption) (any, error) {
	return &Runner{
		operation:            c.Operation,
		selectedOutputGroups: c.SelectedOutputGroups,
		mainInputName:        c.MainInputName,
	}, nil
}

func readSetConfig(n *vo.Node) ([]SelectedOutputGroup, string) {
	if n == nil || n.Data.Inputs == nil || n.Data.Inputs.MirapMMSISet == nil {
		return nil, ""
	}
	rawGroups := n.Data.Inputs.MirapMMSISet.SelectedOutputGroups
	groups := make([]SelectedOutputGroup, 0, len(rawGroups))
	for _, group := range rawGroups {
		groups = append(groups, SelectedOutputGroup{
			InputName: group.InputName,
			Fields:    group.Fields,
		})
	}
	return groups, n.Data.Inputs.MirapMMSISet.MainInputName
}

func nodeType(op Operation) entity.NodeType {
	switch op {
	case OpIntersection:
		return entity.NodeTypeMirapMMSIIntersection
	case OpUnion:
		return entity.NodeTypeMirapMMSIUnion
	case OpDifference:
		return entity.NodeTypeMirapMMSIDifference
	default:
		return entity.NodeTypeMirapMMSIIntersection
	}
}

func operationFromNodeType(t entity.NodeType) Operation {
	switch t {
	case entity.NodeTypeMirapMMSIUnion:
		return OpUnion
	case entity.NodeTypeMirapMMSIDifference:
		return OpDifference
	default:
		return OpIntersection
	}
}

type Runner struct {
	operation Operation

	selectedOutputGroups []SelectedOutputGroup
	mainInputName        string
}

func (r *Runner) Invoke(_ context.Context, input map[string]any) (map[string]any, error) {
	if len(r.selectedOutputGroups) == 0 {
		return nil, fmt.Errorf("selected output groups are required")
	}

	switch r.operation {
	case OpIntersection:
		return r.invokeIntersection(input)
	case OpUnion:
		return r.invokeUnion(input)
	case OpDifference:
		return r.invokeDifference(input)
	default:
		return nil, fmt.Errorf("unsupported mmsi set operation: %s", r.operation)
	}
}

func (r *Runner) invokeIntersection(input map[string]any) (map[string]any, error) {
	indexes, orderedKeys, err := buildInputIndexes(input, r.selectedOutputGroups)
	if err != nil {
		return nil, err
	}
	if len(indexes) < 2 {
		return nil, fmt.Errorf("intersection requires at least two input result sets")
	}

	common := make(map[string]struct{}, len(indexes[0].records))
	for key := range indexes[0].records {
		common[key] = struct{}{}
	}
	for _, idx := range indexes[1:] {
		for key := range common {
			if _, ok := idx.records[key]; !ok {
				delete(common, key)
			}
		}
	}

	result := make([]any, 0, len(common))
	for _, key := range orderedKeys {
		if _, ok := common[key]; !ok {
			continue
		}
		result = append(result, mergeRecord(key, indexes))
	}
	return map[string]any{outputResult: result}, nil
}

func (r *Runner) invokeUnion(input map[string]any) (map[string]any, error) {
	indexes, orderedKeys, err := buildInputIndexes(input, r.selectedOutputGroups)
	if err != nil {
		return nil, err
	}
	if len(indexes) < 2 {
		return nil, fmt.Errorf("union requires at least two input result sets")
	}

	result := make([]any, 0, len(orderedKeys))
	for _, key := range orderedKeys {
		result = append(result, mergeRecord(key, indexes))
	}
	return map[string]any{outputResult: result}, nil
}

func (r *Runner) invokeDifference(input map[string]any) (map[string]any, error) {
	if r.mainInputName == "" {
		return nil, fmt.Errorf("main input name is required for difference")
	}

	indexes, _, err := buildInputIndexes(input, r.selectedOutputGroups)
	if err != nil {
		return nil, err
	}
	if len(indexes) < 2 {
		return nil, fmt.Errorf("difference requires at least two input result sets")
	}

	var main *inputIndex
	others := make([]*inputIndex, 0, len(indexes)-1)
	for _, idx := range indexes {
		if idx.name == r.mainInputName {
			main = idx
		} else {
			others = append(others, idx)
		}
	}
	if main == nil {
		return nil, fmt.Errorf("main input %q is not selected", r.mainInputName)
	}

	excluded := make(map[string]struct{})
	for _, idx := range others {
		for key := range idx.records {
			excluded[key] = struct{}{}
		}
	}

	result := make([]any, 0, len(main.keys))
	for _, key := range main.keys {
		if _, ok := excluded[key]; ok {
			continue
		}
		result = append(result, mergeRecord(key, []*inputIndex{main}))
	}
	return map[string]any{outputResult: result}, nil
}

type inputIndex struct {
	name   string
	fields []string

	records map[string]map[string]any
	keys    []string
}

func buildInputIndexes(input map[string]any, groups []SelectedOutputGroup) ([]*inputIndex, []string, error) {
	indexes := make([]*inputIndex, 0, len(groups))
	seenGlobal := make(map[string]struct{})
	orderedKeys := make([]string, 0)

	for _, group := range groups {
		if group.InputName == "" {
			continue
		}
		idx, err := indexInput(group.InputName, group.Fields, input[group.InputName])
		if err != nil {
			return nil, nil, err
		}
		indexes = append(indexes, idx)
		for _, key := range idx.keys {
			if _, ok := seenGlobal[key]; ok {
				continue
			}
			seenGlobal[key] = struct{}{}
			orderedKeys = append(orderedKeys, key)
		}
	}

	return indexes, orderedKeys, nil
}

func indexInput(name string, fields []string, raw any) (*inputIndex, error) {
	items, err := normalizeObjectArray(raw)
	if err != nil {
		return nil, fmt.Errorf("input %s must be an array of objects: %w", name, err)
	}

	selected := normalizeFields(fields)
	idx := &inputIndex{
		name:    name,
		fields:  selected,
		records: make(map[string]map[string]any),
		keys:    make([]string, 0, len(items)),
	}

	for _, item := range items {
		record, ok := normalizeRecord(item)
		if !ok {
			continue
		}
		mmsi := normalizeMMSI(record["mmsi"])
		if mmsi == "" {
			continue
		}
		if _, exists := idx.records[mmsi]; exists {
			continue
		}

		projected := make(map[string]any, len(selected))
		for _, field := range selected {
			if field == "mmsi" {
				projected[field] = mmsi
				continue
			}
			if value, ok := record[field]; ok {
				projected[field] = value
			} else {
				projected[field] = nil
			}
		}
		idx.records[mmsi] = projected
		idx.keys = append(idx.keys, mmsi)
	}

	return idx, nil
}

func normalizeObjectArray(raw any) ([]any, error) {
	if wrapper, ok := raw.(map[string]any); ok {
		unwrapped := false
		for _, key := range []string{"ships", "result"} {
			if value, exists := wrapper[key]; exists {
				raw = value
				unwrapped = true
				break
			}
		}
		if !unwrapped && len(wrapper) == 1 {
			for _, value := range wrapper {
				raw = value
			}
		}
	}

	if encoded, ok := raw.(string); ok {
		var decoded []any
		if err := json.Unmarshal([]byte(encoded), &decoded); err != nil {
			return nil, fmt.Errorf("got string containing invalid JSON array")
		}
		return decoded, nil
	}

	value := reflect.ValueOf(raw)
	if !value.IsValid() || (value.Kind() != reflect.Slice && value.Kind() != reflect.Array) {
		return nil, fmt.Errorf("got %T", raw)
	}
	items := make([]any, value.Len())
	for i := 0; i < value.Len(); i++ {
		items[i] = value.Index(i).Interface()
	}
	return items, nil
}

func normalizeRecord(item any) (map[string]any, bool) {
	if record, ok := item.(map[string]any); ok {
		return record, true
	}
	encoded, err := json.Marshal(item)
	if err != nil {
		return nil, false
	}
	var record map[string]any
	if err := json.Unmarshal(encoded, &record); err != nil {
		return nil, false
	}
	return record, true
}

func normalizeFields(fields []string) []string {
	seen := map[string]struct{}{"mmsi": {}}
	out := []string{"mmsi"}
	for _, field := range fields {
		if field == "" || field == "mmsi" {
			continue
		}
		if _, ok := seen[field]; ok {
			continue
		}
		seen[field] = struct{}{}
		out = append(out, field)
	}
	return out
}

func normalizeMMSI(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case int:
		return strconv.FormatInt(int64(v), 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strings.TrimSpace(strconv.FormatFloat(v, 'f', -1, 64))
	case json.Number:
		return strings.TrimSpace(v.String())
	default:
		return ""
	}
}

func mergeRecord(mmsi string, indexes []*inputIndex) map[string]any {
	fieldSet := make(map[string]struct{})
	fields := []string{"mmsi"}
	fieldSet["mmsi"] = struct{}{}
	for _, idx := range indexes {
		for _, field := range idx.fields {
			if _, ok := fieldSet[field]; ok {
				continue
			}
			fieldSet[field] = struct{}{}
			fields = append(fields, field)
		}
	}

	out := make(map[string]any, len(fields))
	for _, field := range fields {
		if field == "mmsi" {
			out[field] = mmsi
			continue
		}
		out[field] = firstValue(mmsi, field, indexes)
	}
	return out
}

func firstValue(mmsi string, field string, indexes []*inputIndex) any {
	for _, idx := range indexes {
		record, ok := idx.records[mmsi]
		if !ok {
			continue
		}
		value, ok := record[field]
		if ok && value != nil {
			return value
		}
	}
	return nil
}
