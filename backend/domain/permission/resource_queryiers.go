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

package permission

import (
	"context"
	"fmt"

	"github.com/coze-dev/coze-studio/backend/api/model/data/database/table"
	"github.com/coze-dev/coze-studio/backend/crossdomain/database"
	crossuser "github.com/coze-dev/coze-studio/backend/crossdomain/user"
	crossworkflow "github.com/coze-dev/coze-studio/backend/crossdomain/workflow"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"

	databaseModel "github.com/coze-dev/coze-studio/backend/crossdomain/database/model"
)

type WorkflowResourceQueryer struct {
	workflowService crossworkflow.Workflow
}

func NewWorkflowResourceQueryer() *WorkflowResourceQueryer {
	return &WorkflowResourceQueryer{
		workflowService: crossworkflow.DefaultSVC(),
	}
}

func (q *WorkflowResourceQueryer) QueryResourceInfo(ctx context.Context, resourceIDs []int64, isDraft *bool) ([]*ResourceInfo, error) {

	workflows, _, err := q.workflowService.MGet(ctx, &vo.MGetPolicy{

		QType:    crossworkflow.FromDraft,
		MetaOnly: true,
		MetaQuery: vo.MetaQuery{
			IDs: resourceIDs,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query workflows: %w", err)
	}
	var result []*ResourceInfo
	for _, workflow := range workflows {
		result = append(result, &ResourceInfo{
			ID:        workflow.ID,
			CreatorID: workflow.CreatorID,
			SpaceID:   &workflow.SpaceID,
		})
	}

	return result, nil
}

func (q *WorkflowResourceQueryer) GetResourceType() ResourceType {
	return ResourceTypeWorkflow
}

type DatabaseResourceQueryer struct {
	databaseService database.Database
}

func NewDatabaseResourceQueryer() *DatabaseResourceQueryer {
	return &DatabaseResourceQueryer{
		databaseService: database.DefaultSVC(),
	}
}

func (q *DatabaseResourceQueryer) QueryResourceInfo(ctx context.Context, resourceIDs []int64, isDraft *bool) ([]*ResourceInfo, error) {
	var basics []*databaseModel.DatabaseBasic
	for _, id := range resourceIDs {
		basic := &databaseModel.DatabaseBasic{
			ID:        id,
			TableType: table.TableType_DraftTable,
		}
		if isDraft != nil && !*isDraft {
			basic.TableType = table.TableType_OnlineTable
		}
		basics = append(basics, basic)
	}

	resp, err := q.databaseService.MGetDatabase(ctx, &databaseModel.MGetDatabaseRequest{
		Basics: basics,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query database: %w", err)
	}

	var result []*ResourceInfo
	for _, dbInfo := range resp.Databases {
		if dbInfo != nil {
			result = append(result, &ResourceInfo{
				ID:        dbInfo.ID,
				CreatorID: dbInfo.CreatorID,
				SpaceID:   &dbInfo.SpaceID,
			})
		}
	}

	return result, nil
}

func (q *DatabaseResourceQueryer) GetResourceType() ResourceType {
	return ResourceTypeDatabase
}

type WorkspaceResourceQueryer struct {
	userService crossuser.User
}

func NewWorkspaceResourceQueryer() *WorkspaceResourceQueryer {
	return &WorkspaceResourceQueryer{
		userService: crossuser.DefaultSVC(),
	}
}

func (q *WorkspaceResourceQueryer) QueryResourceInfo(ctx context.Context, resourceIDs []int64, isDraft *bool) ([]*ResourceInfo, error) {
	// For workspace resources, we need to get space information for each user
	var result []*ResourceInfo

	spaces, err := q.userService.GetUserSpaceBySpaceID(ctx, resourceIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get user space list for space %v: %w", resourceIDs, err)
	}

	for _, space := range spaces {
		if space != nil {
			result = append(result, &ResourceInfo{
				ID:        space.ID,
				CreatorID: space.CreatorID,
				SpaceID:   &space.ID,
			})
		}
	}

	return result, nil
}

func (q *WorkspaceResourceQueryer) GetResourceType() ResourceType {
	return ResourceTypeWorkspace
}
