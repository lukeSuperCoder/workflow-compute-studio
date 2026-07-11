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

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	coze "github.com/coze-dev/coze-studio/backend/api/handler/coze"
	"github.com/coze-dev/coze-studio/backend/infra/storage"
)

func Register(r *server.Hertz, st storage.Storage) {
	r.GET("/healthz", func(_ context.Context, c *app.RequestContext) {
		c.JSON(consts.StatusOK, map[string]string{"status": "ok"})
	})

	files := NewFileHandler(st)
	r.GET("/assets/*path", files.GetPublicAsset)

	api := r.Group("/api")
	fileAPI := api.Group("/files")
	fileAPI.POST("/upload", files.Upload)
	fileAPI.GET("/*path", files.GetPrivateFile)
	fileAPI.DELETE("/*path", files.DeletePrivateFile)

	workflowAPI := api.Group("/workflow_api")

	workflowAPI.POST("/create", coze.CreateWorkflow)
	workflowAPI.POST("/canvas", coze.GetCanvasInfo)
	workflowAPI.POST("/save", coze.SaveWorkflow)
	workflowAPI.POST("/publish", coze.PublishWorkflow)
	workflowAPI.POST("/update_meta", coze.UpdateWorkflowMeta)
	workflowAPI.POST("/delete", coze.DeleteWorkflow)
	workflowAPI.POST("/copy", coze.CopyWorkflow)
	workflowAPI.POST("/workflow_list", coze.GetWorkFlowList)
	workflowAPI.POST("/workflow_detail", coze.GetWorkflowDetail)
	workflowAPI.POST("/workflow_detail_info", coze.GetWorkflowDetailInfo)
	workflowAPI.POST("/node_type", coze.QueryWorkflowNodeTypes)
	workflowAPI.POST("/node_template_list", coze.NodeTemplateList)
	workflowAPI.POST("/validate_tree", coze.ValidateTree)
	workflowAPI.POST("/workflow_references", coze.GetWorkflowReferences)
	workflowAPI.POST("/released_workflows", coze.GetReleasedWorkflows)
	workflowAPI.POST("/test_run", coze.WorkFlowTestRun)
	workflowAPI.POST("/nodeDebug", coze.WorkflowNodeDebugV2)
	workflowAPI.GET("/get_process", coze.GetWorkFlowProcess)
	workflowAPI.POST("/cancel", coze.CancelWorkFlow)
}
