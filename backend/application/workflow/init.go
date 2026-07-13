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
	"path/filepath"

	"os"

	"gopkg.in/yaml.v3"

	"github.com/cloudwego/eino/callbacks"
	"github.com/cloudwego/eino/compose"
	"gorm.io/gorm"

	dbservice "github.com/coze-dev/coze-studio/backend/domain/memory/database/service"
	variables "github.com/coze-dev/coze-studio/backend/domain/memory/variables/service"
	"github.com/coze-dev/coze-studio/backend/domain/workflow"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/config"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/service"
	"github.com/coze-dev/coze-studio/backend/infra/cache"
	"github.com/coze-dev/coze-studio/backend/infra/coderunner"
	"github.com/coze-dev/coze-studio/backend/infra/idgen"
	"github.com/coze-dev/coze-studio/backend/infra/imagex"
	"github.com/coze-dev/coze-studio/backend/infra/storage"
)

type ServiceComponents struct {
	IDGen              idgen.IDGenerator
	DB                 *gorm.DB
	Cache              cache.Cmdable
	DatabaseDomainSVC  dbservice.Database
	VariablesDomainSVC variables.Variables
	DomainNotifier     any
	Tos                storage.Storage
	ImageX             imagex.ImageX
	CPStore            compose.CheckPointStore
	CodeRunner         coderunner.Runner

	// NodeSet, when non-nil, restricts node adaptor registration and the
	// node_type catalog to the whitelisted node types. Used by the
	// workflow-only (Mirap) backend via entity.MirapNodeSet.
	NodeSet map[entity.NodeType]bool
}

func initWorkflowConfig() (workflow.WorkflowConfig, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	configPath := filepath.Join(wd, "resources/conf/workflow/config.yaml")
	configBs, err := os.ReadFile(configPath)
	if os.IsNotExist(err) {
		configPath = filepath.Join(wd, "conf/workflow/config.yaml")
		configBs, err = os.ReadFile(configPath)
	}
	if err != nil {
		return nil, err
	}
	var cfg *config.WorkflowConfig
	err = yaml.Unmarshal(configBs, &cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func InitService(_ context.Context, components *ServiceComponents) (*ApplicationService, error) {
	if components.NodeSet == nil {
		service.RegisterAllNodeAdaptors()
	} else {
		service.RegisterNodeAdaptorsForSet(components.NodeSet)
		SVC.SetNodeSet(components.NodeSet)
	}

	cfg, err := initWorkflowConfig()
	if err != nil {
		return nil, err
	}

	workflowRepo, err := service.NewWorkflowRepository(components.IDGen, components.DB, components.Cache,
		components.Tos, components.CPStore, cfg)
	if err != nil {
		return nil, err
	}

	workflow.SetRepository(workflowRepo)

	workflowDomainSVC := service.NewWorkflowService(workflowRepo)

	coderunner.SetCodeRunner(components.CodeRunner)
	callbacks.AppendGlobalHandlers(service.GetTokenCallbackHandler())

	setEventBus(components.DomainNotifier)

	SVC.DomainSVC = workflowDomainSVC
	SVC.ImageX = components.ImageX
	SVC.TosClient = components.Tos
	SVC.IDGenerator = components.IDGen

	err = SVC.InitNodeIconURLCache(context.Background())
	if err != nil {
		return nil, err
	}

	return SVC, nil
}
