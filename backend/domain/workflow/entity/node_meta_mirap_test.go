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

package entity

import (
	"testing"
)

func TestMirapNodeSetBasics(t *testing.T) {
	for nt := range MirapNodeSet {
		meta := NodeMetaByNodeType(nt)
		if meta == nil {
			t.Fatalf("MirapNodeSet entry %q has no NodeTypeMeta", nt)
		}
		if meta.ID == 0 {
			t.Fatalf("MirapNodeSet entry %q has zero ID", nt)
		}
	}
	for nt := range MirapNodeSet {
		got := IDStrToNodeType(nt.IDStr())
		if got != nt {
			t.Fatalf("IDStr round-trip mismatch: %q -> %q -> %q", nt, nt.IDStr(), got)
		}
	}
}

func TestMirapCustomNodeMetadata(t *testing.T) {
	tests := []struct {
		nodeType NodeType
		id       int64
		category string
	}{
		{NodeTypeMirapAreaShipExtractor, 1001, "operator"},
		{NodeTypeMirapStayCalculation, 1002, "operator"},
		{NodeTypeMirapHoverDetail, 1003, "operator"},
		{NodeTypeMirapMMSIIntersection, 2001, "operator_logic"},
		{NodeTypeMirapMMSIUnion, 2002, "operator_logic"},
		{NodeTypeMirapMMSIDifference, 2003, "operator_logic"},
	}
	seen := map[int64]NodeType{}
	for _, tt := range tests {
		meta := NodeMetaByNodeType(tt.nodeType)
		if meta == nil {
			t.Fatalf("missing metadata for %q", tt.nodeType)
		}
		if meta.ID != tt.id {
			t.Errorf("%s ID = %d, want %d", tt.nodeType, meta.ID, tt.id)
		}
		if meta.Category != tt.category {
			t.Errorf("%s category = %q, want %q", tt.nodeType, meta.Category, tt.category)
		}
		if previous, ok := seen[meta.ID]; ok {
			t.Fatalf("duplicate ID %d for %s and %s", meta.ID, previous, tt.nodeType)
		}
		seen[meta.ID] = tt.nodeType
	}
}

func TestMirapCategoryOrder(t *testing.T) {
	want := []Category{
		{Key: "", Name: "", EnUSName: ""},
		{Key: "operator", Name: "算子", EnUSName: "Operator"},
		{Key: "operator_logic", Name: "算子业务逻辑", EnUSName: "Operator logic"},
	}
	for i, expected := range want {
		if Categories[i] != expected {
			t.Errorf("Categories[%d] = %#v, want %#v", i, Categories[i], expected)
		}
	}
}

func TestMirapNodeSetExcludes(t *testing.T) {
	excluded := []NodeType{
		NodeTypeLLM,
		NodeTypePlugin,
		NodeTypeCodeRunner,
		NodeTypeIntentDetector,
		NodeTypeQuestionAnswer,
		NodeTypeKnowledgeRetriever,
		NodeTypeKnowledgeIndexer,
		NodeTypeKnowledgeDeleter,
		NodeTypeDatabaseInsert,
		NodeTypeDatabaseQuery,
		NodeTypeDatabaseCustomSQL,
		NodeTypeCreateConversation,
		NodeTypeConversationList,
		NodeTypeMessageList,
		NodeTypeCreateMessage,
	}
	for _, nt := range excluded {
		if IsMirapNode(nt) {
			t.Fatalf("node type %q should NOT be in MirapNodeSet", nt)
		}
	}
}

func TestMirapNodeSetIncludes(t *testing.T) {
	included := []NodeType{
		NodeTypeEntry,
		NodeTypeExit,
		NodeTypeInputReceiver,
		NodeTypeOutputEmitter,
		NodeTypeSelector,
		NodeTypeLoop,
		NodeTypeBatch,
		NodeTypeBreak,
		NodeTypeContinue,
		NodeTypeVariableAssigner,
		NodeTypeVariableAggregator,
		NodeTypeJsonSerialization,
		NodeTypeJsonDeserialization,
		NodeTypeTextProcessor,
		NodeTypeHTTPRequester,
		NodeTypeSubWorkflow,
		NodeTypeComment,
		NodeTypeMirapAreaShipExtractor,
		NodeTypeMirapStayCalculation,
		NodeTypeMirapHoverDetail,
		NodeTypeMirapMMSIIntersection,
		NodeTypeMirapMMSIUnion,
		NodeTypeMirapMMSIDifference,
	}
	for _, nt := range included {
		if !IsMirapNode(nt) {
			t.Fatalf("node type %q should be in MirapNodeSet", nt)
		}
	}
}
