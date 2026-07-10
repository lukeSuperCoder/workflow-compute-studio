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
	"testing"

	"github.com/cloudwego/eino/compose"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
)

func TestRunnerIntersectionMergesSelectedGroups(t *testing.T) {
	runner := &Runner{
		operation: OpIntersection,
		selectedOutputGroups: []SelectedOutputGroup{
			{InputName: "dataset_1", Fields: []string{"mmsi", "name", "shipType"}},
			{InputName: "dataset_2", Fields: []string{"mmsi", "speed", "name"}},
		},
	}

	output, err := runner.Invoke(context.Background(), map[string]any{
		"dataset_1": []any{
			map[string]any{"mmsi": "1", "name": "船A", "shipType": "货船"},
			map[string]any{"mmsi": "2", "name": "船B", "shipType": "油轮"},
		},
		"dataset_2": []any{
			map[string]any{"mmsi": "2", "speed": 12, "name": "船B-更新"},
			map[string]any{"mmsi": "3", "speed": 15, "name": "船C"},
		},
	})

	require.NoError(t, err)
	result := output[outputResult].([]any)
	require.Len(t, result, 1)
	assert.Equal(t, map[string]any{
		"mmsi":     "2",
		"name":     "船B",
		"shipType": "油轮",
		"speed":    12,
	}, result[0])
}

func TestRunnerUnionKeepsAllMMSIAndFillsMissingFields(t *testing.T) {
	runner := &Runner{
		operation: OpUnion,
		selectedOutputGroups: []SelectedOutputGroup{
			{InputName: "dataset_1", Fields: []string{"mmsi", "name"}},
			{InputName: "dataset_2", Fields: []string{"mmsi", "speed"}},
		},
	}

	output, err := runner.Invoke(context.Background(), map[string]any{
		"dataset_1": []any{
			map[string]any{"mmsi": float64(1), "name": "船A"},
			map[string]any{"mmsi": "2", "name": "船B"},
		},
		"dataset_2": []any{
			map[string]any{"mmsi": "2", "speed": 12},
			map[string]any{"mmsi": "3", "speed": 15},
		},
	})

	require.NoError(t, err)
	result := output[outputResult].([]any)
	require.Len(t, result, 3)
	assert.Equal(t, map[string]any{"mmsi": "1", "name": "船A", "speed": nil}, result[0])
	assert.Equal(t, map[string]any{"mmsi": "2", "name": "船B", "speed": 12}, result[1])
	assert.Equal(t, map[string]any{"mmsi": "3", "name": nil, "speed": 15}, result[2])
}

func TestRunnerUnionAcceptsWrappedAndTypedObjectArrays(t *testing.T) {
	runner := &Runner{
		operation: OpUnion,
		selectedOutputGroups: []SelectedOutputGroup{
			{InputName: "dataset_1", Fields: []string{"mmsi", "name"}},
			{InputName: "dataset_2", Fields: []string{"mmsi", "speed"}},
		},
	}

	output, err := runner.Invoke(context.Background(), map[string]any{
		"dataset_1": map[string]any{
			"ships": []map[string]any{{"mmsi": int64(1), "name": "船A"}},
		},
		"dataset_2": []map[string]any{{"mmsi": int64(2), "speed": 12}},
	})

	require.NoError(t, err)
	assert.Equal(t, []any{
		map[string]any{"mmsi": "1", "name": "船A", "speed": nil},
		map[string]any{"mmsi": "2", "name": nil, "speed": 12},
	}, output[outputResult])
}

func TestRunnerDifferenceUsesMainOnlyForProjection(t *testing.T) {
	runner := &Runner{
		operation:     OpDifference,
		mainInputName: "dataset_1",
		selectedOutputGroups: []SelectedOutputGroup{
			{InputName: "dataset_1", Fields: []string{"mmsi", "name"}},
			{InputName: "dataset_2", Fields: []string{"mmsi", "speed"}},
		},
	}

	output, err := runner.Invoke(context.Background(), map[string]any{
		"dataset_1": []any{
			map[string]any{"mmsi": "1", "name": "船A"},
			map[string]any{"mmsi": "2", "name": "船B"},
			map[string]any{"mmsi": "3", "name": "船C"},
		},
		"dataset_2": []any{
			map[string]any{"mmsi": "2", "speed": 12},
		},
	})

	require.NoError(t, err)
	result := output[outputResult].([]any)
	require.Len(t, result, 2)
	assert.Equal(t, map[string]any{"mmsi": "1", "name": "船A"}, result[0])
	assert.Equal(t, map[string]any{"mmsi": "3", "name": "船C"}, result[1])
}

func TestRunnerSkipsInvalidMMSIAndKeepsFirstDuplicate(t *testing.T) {
	runner := &Runner{
		operation: OpUnion,
		selectedOutputGroups: []SelectedOutputGroup{
			{InputName: "dataset_1", Fields: []string{"mmsi", "name"}},
			{InputName: "dataset_2", Fields: []string{"mmsi", "speed"}},
		},
	}

	output, err := runner.Invoke(context.Background(), map[string]any{
		"dataset_1": []any{
			map[string]any{"mmsi": "", "name": "无效"},
			map[string]any{"mmsi": "1", "name": "第一条"},
			map[string]any{"mmsi": "1", "name": "重复条"},
		},
		"dataset_2": []any{
			map[string]any{"mmsi": "1", "speed": 10},
		},
	})

	require.NoError(t, err)
	result := output[outputResult].([]any)
	require.Len(t, result, 1)
	assert.Equal(t, map[string]any{"mmsi": "1", "name": "第一条", "speed": 10}, result[0])
}

func TestConfigAdaptBackfillsInputsFromCanvasEdges(t *testing.T) {
	canvas := &vo.Canvas{
		Nodes: []*vo.Node{
			areaShipNode("124132"),
			areaShipNode("177387"),
		},
		Edges: []*vo.Edge{
			{SourceNodeID: "124132", TargetNodeID: "180552"},
			{SourceNodeID: "177387", TargetNodeID: "180552"},
		},
	}
	node := &vo.Node{
		ID:   "180552",
		Type: "1003",
		Data: &vo.Data{
			Meta: &vo.NodeMetaFE{Title: "MMSI 并集"},
			Inputs: &vo.Inputs{
				MirapMMSISet: &vo.MirapMMSISet{
					SelectedOutputGroups: []vo.MirapMMSISelectedOutputGroup{
						{InputName: "dataset_1", Fields: []string{"mmsi"}},
						{InputName: "dataset_2", Fields: []string{"mmsi"}},
					},
				},
			},
			Outputs: []any{
				&vo.Variable{
					Name: "result",
					Type: vo.VariableTypeList,
					Schema: &vo.Variable{
						Type: vo.VariableTypeObject,
						Schema: []any{
							map[string]any{"name": "mmsi", "type": vo.VariableTypeInteger},
						},
					},
				},
			},
		},
	}

	ns, err := NewUnionConfig().Adapt(context.Background(), node, nodes.WithCanvas(canvas))

	require.NoError(t, err)
	require.Contains(t, ns.InputTypes, "dataset_1")
	require.Contains(t, ns.InputTypes, "dataset_2")
	require.Len(t, ns.InputSources, 2)
	assert.Equal(t, compose.FieldPath{"dataset_1"}, ns.InputSources[0].Path)
	assert.Equal(t, vo.NodeKey("124132"), ns.InputSources[0].Source.Ref.FromNodeKey)
	assert.Equal(t, compose.FieldPath{"ships"}, ns.InputSources[0].Source.Ref.FromPath)
	assert.Equal(t, compose.FieldPath{"dataset_2"}, ns.InputSources[1].Path)
	assert.Equal(t, vo.NodeKey("177387"), ns.InputSources[1].Source.Ref.FromNodeKey)
	assert.Equal(t, compose.FieldPath{"ships"}, ns.InputSources[1].Source.Ref.FromPath)
}

func areaShipNode(id string) *vo.Node {
	return &vo.Node{
		ID: id,
		Data: &vo.Data{
			Outputs: []any{
				&vo.Variable{
					Name: "ships",
					Type: vo.VariableTypeList,
					Schema: &vo.Variable{
						Type: vo.VariableTypeObject,
						Schema: []any{
							map[string]any{"name": "mmsi", "type": vo.VariableTypeInteger},
						},
					},
				},
			},
		},
	}
}
