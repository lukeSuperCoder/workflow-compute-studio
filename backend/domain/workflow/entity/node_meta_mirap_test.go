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
