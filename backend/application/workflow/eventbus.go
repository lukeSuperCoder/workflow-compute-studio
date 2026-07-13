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

package workflow

import (
	"context"
)

type resourceOp int

const (
	resourceCreated resourceOp = iota + 1
	resourceUpdated
	resourceDeleted
)

type workflowResourceDocument struct {
	Name          *string
	APPID         *int64
	SpaceID       *int64
	OwnerID       *int64
	PublishStatus any
	CreateTimeMS  *int64
	UpdateTimeMS  *int64
	PublishTimeMS *int64
}

func setEventBus(_ any) {}

func PublishWorkflowResource(context.Context, int64, *int32, resourceOp, *workflowResourceDocument) error {
	return nil
}
