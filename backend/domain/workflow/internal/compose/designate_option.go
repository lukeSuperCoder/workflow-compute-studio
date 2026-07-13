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

package compose

import (
	"context"
	"slices"
	"strconv"

	einoCompose "github.com/cloudwego/eino/compose"

	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity/vo"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/execute"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/internal/nodes/exit"
	schema2 "github.com/coze-dev/coze-studio/backend/domain/workflow/internal/schema"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/ptr"
)

func (r *WorkflowRunner) designateOptions(ctx context.Context) ([]einoCompose.Option, error) {
	var (
		wb           = r.basic
		exeCfg       = r.config
		executeID    = r.executeID
		workflowSC   = r.schema
		eventChan    = r.eventChan
		resumedEvent = r.interruptEvent
	)

	if wb.AppID != nil && exeCfg.AppID == nil {
		exeCfg.AppID = wb.AppID
	}

	rootHandler := execute.NewRootWorkflowHandler(
		wb,
		executeID,
		workflowSC.RequireCheckpoint(),
		eventChan,
		resumedEvent,
		exeCfg,
		workflowSC.NodeCount())

	opts := []einoCompose.Option{einoCompose.WithCallbacks(rootHandler)}

	for key := range workflowSC.GetAllNodes() {
		ns := workflowSC.GetAllNodes()[key]

		var nodeOpt einoCompose.Option
		if ns.Type == entity.NodeTypeExit {
			nodeOpt = nodeCallbackOption(key, ns.Name, eventChan, resumedEvent,
				ptr.Of(ns.Configs.(*exit.Config).TerminatePlan))
		} else if ns.Type != entity.NodeTypeLambda {
			nodeOpt = nodeCallbackOption(key, ns.Name, eventChan, resumedEvent, nil)
		}

		if parent, ok := workflowSC.Hierarchy[key]; !ok { // top level nodes, just add the node handler
			opts = append(opts, nodeOpt)
			if ns.Type == entity.NodeTypeSubWorkflow {
				subOpts, err := r.designateOptionsForSubWorkflow(ctx,
					rootHandler.(*execute.WorkflowHandler),
					ns,
					string(key))
				if err != nil {
					return nil, err
				}
				opts = append(opts, subOpts...)
			}
		} else {
			parent := workflowSC.GetAllNodes()[parent]
			opts = append(opts, WrapOpt(nodeOpt, parent.Key))
			if ns.Type == entity.NodeTypeSubWorkflow {
				subOpts, err := r.designateOptionsForSubWorkflow(ctx,
					rootHandler.(*execute.WorkflowHandler),
					ns,
					string(key))
				if err != nil {
					return nil, err
				}
				for _, subO := range subOpts {
					opts = append(opts, WrapOpt(subO, parent.Key))
				}
			}
		}
	}

	if workflowSC.RequireCheckpoint() {
		opts = append(opts, einoCompose.WithCheckPointID(strconv.FormatInt(executeID, 10)))
	}

	return opts, nil
}

func nodeCallbackOption(key vo.NodeKey, name string, eventChan chan *execute.Event, resumeEvent *entity.InterruptEvent,
	terminatePlan *vo.TerminatePlan) einoCompose.Option {
	return einoCompose.WithCallbacks(execute.NewNodeHandler(string(key), name, eventChan, resumeEvent, terminatePlan)).DesignateNode(string(key))
}

func WrapOpt(opt einoCompose.Option, parentNodeKey vo.NodeKey) einoCompose.Option {
	return einoCompose.WithLambdaOption(nodes.WithOptsForNested(opt)).DesignateNode(string(parentNodeKey))
}

func WrapOptWithIndex(opt einoCompose.Option, parentNodeKey vo.NodeKey, index int) einoCompose.Option {
	return einoCompose.WithLambdaOption(nodes.WithOptsForIndexed(index, opt)).DesignateNode(string(parentNodeKey))
}

func (r *WorkflowRunner) designateOptionsForSubWorkflow(ctx context.Context,
	parentHandler *execute.WorkflowHandler,
	ns *schema2.NodeSchema,
	pathPrefix ...string) (opts []einoCompose.Option, err error) {
	var (
		resumeEvent = r.interruptEvent
		eventChan   = r.eventChan
	)
	subHandler := execute.NewSubWorkflowHandler(
		parentHandler,
		ns.SubWorkflowBasic,
		resumeEvent,
		ns.SubWorkflowSchema.NodeCount(),
	)

	opts = append(opts, WrapOpt(einoCompose.WithCallbacks(subHandler), ns.Key))

	workflowSC := ns.SubWorkflowSchema
	for key := range workflowSC.GetAllNodes() {
		subNS := workflowSC.GetAllNodes()[key]
		fullPath := append(slices.Clone(pathPrefix), string(subNS.Key))

		var nodeOpt einoCompose.Option
		if subNS.Type == entity.NodeTypeExit {
			nodeOpt = nodeCallbackOption(key, subNS.Name, eventChan, resumeEvent,
				ptr.Of(subNS.Configs.(*exit.Config).TerminatePlan))
		} else {
			nodeOpt = nodeCallbackOption(key, subNS.Name, eventChan, resumeEvent, nil)
		}

		if parent, ok := workflowSC.Hierarchy[key]; !ok { // top level nodes, just add the node handler
			opts = append(opts, WrapOpt(nodeOpt, ns.Key))
			if subNS.Type == entity.NodeTypeSubWorkflow {
				subOpts, err := r.designateOptionsForSubWorkflow(ctx,
					subHandler.(*execute.WorkflowHandler),
					subNS,
					fullPath...)
				if err != nil {
					return nil, err
				}
				for _, subO := range subOpts {
					opts = append(opts, WrapOpt(subO, ns.Key))
				}
			}
		} else {
			parent := workflowSC.GetAllNodes()[parent]
			opts = append(opts, WrapOpt(WrapOpt(nodeOpt, parent.Key), ns.Key))
			if subNS.Type == entity.NodeTypeSubWorkflow {
				subOpts, err := r.designateOptionsForSubWorkflow(ctx,
					subHandler.(*execute.WorkflowHandler),
					subNS,
					fullPath...)
				if err != nil {
					return nil, err
				}
				for _, subO := range subOpts {
					opts = append(opts, WrapOpt(WrapOpt(subO, parent.Key), ns.Key))
				}
			}
		}
	}

	return opts, nil
}
