/* Copyright 2025 coze-dev Authors. Licensed under the Apache License, Version 2.0. */
package miraphttpapi

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
)

func TestSpecsCoverGuideOneThroughTwentyOneWithoutExistingNodes(t *testing.T) {
	require.Len(t, Specs, 19)
	seenTypes := make(map[entity.NodeType]bool, len(Specs))
	seenIDs := make(map[int64]bool, len(Specs))
	for _, spec := range Specs {
		require.NotEmpty(t, spec.Path)
		require.NotEmpty(t, spec.Inputs)
		require.NotEmpty(t, spec.Outputs)
		assert.False(t, seenTypes[spec.NodeType], "duplicate node type %s", spec.NodeType)
		seenTypes[spec.NodeType] = true
		meta := entity.NodeTypeMetas[spec.NodeType]
		require.NotNil(t, meta)
		assert.Equal(t, "operator", meta.Category)
		assert.False(t, seenIDs[meta.ID], "duplicate node ID %d", meta.ID)
		seenIDs[meta.ID] = true
	}
	assert.False(t, seenTypes[entity.NodeTypeMirapHoverDetail], "existing guide #10 node must not be duplicated")
	assert.False(t, seenTypes[entity.NodeTypeMirapStayCalculation], "existing guide #17 node must not be duplicated")
}

func TestSpeedFilterPreservesDocumentedEndDateCasing(t *testing.T) {
	var speed Spec
	for _, spec := range Specs {
		if spec.NodeType == entity.NodeTypeMirapSpeedFilter {
			speed = spec
			break
		}
	}
	require.NotEmpty(t, speed.Path)
	names := make([]string, 0, len(speed.Inputs))
	for _, field := range speed.Inputs {
		names = append(names, field.Name)
	}
	assert.Contains(t, names, "endDate")
	assert.NotContains(t, names, "enddate")
}
