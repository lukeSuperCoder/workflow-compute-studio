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

package workflowapp

import (
	"context"
	"os"
	"path/filepath"

	"gorm.io/gorm"

	"github.com/coze-dev/coze-studio/backend/application/memory"
	"github.com/coze-dev/coze-studio/backend/application/permission"
	"github.com/coze-dev/coze-studio/backend/application/user"
	appworkflow "github.com/coze-dev/coze-studio/backend/application/workflow"
	crossdatabase "github.com/coze-dev/coze-studio/backend/crossdomain/database"
	databaseImpl "github.com/coze-dev/coze-studio/backend/crossdomain/database/impl"
	crosspermission "github.com/coze-dev/coze-studio/backend/crossdomain/permission"
	permissionImpl "github.com/coze-dev/coze-studio/backend/crossdomain/permission/impl"
	crossuser "github.com/coze-dev/coze-studio/backend/crossdomain/user"
	userImpl "github.com/coze-dev/coze-studio/backend/crossdomain/user/impl"
	crossvariables "github.com/coze-dev/coze-studio/backend/crossdomain/variables"
	variablesImpl "github.com/coze-dev/coze-studio/backend/crossdomain/variables/impl"
	crossworkflow "github.com/coze-dev/coze-studio/backend/crossdomain/workflow"
	workflowImpl "github.com/coze-dev/coze-studio/backend/crossdomain/workflow/impl"
	searchentity "github.com/coze-dev/coze-studio/backend/domain/search/entity"
	searchsvc "github.com/coze-dev/coze-studio/backend/domain/search/service"
	"github.com/coze-dev/coze-studio/backend/domain/workflow/entity"
	"github.com/coze-dev/coze-studio/backend/infra/cache"
	redisImpl "github.com/coze-dev/coze-studio/backend/infra/cache/impl/redis"
	"github.com/coze-dev/coze-studio/backend/infra/checkpoint"
	"github.com/coze-dev/coze-studio/backend/infra/idgen"
	idgenImpl "github.com/coze-dev/coze-studio/backend/infra/idgen/impl/idgen"
	mysqlImpl "github.com/coze-dev/coze-studio/backend/infra/orm/impl/mysql"
	"github.com/coze-dev/coze-studio/backend/infra/storage"
	storageImpl "github.com/coze-dev/coze-studio/backend/infra/storage/impl"
	"github.com/coze-dev/coze-studio/backend/pkg/ctxcache"
	"github.com/coze-dev/coze-studio/backend/pkg/logs"
	"github.com/coze-dev/coze-studio/backend/types/consts"
)

type Dependencies struct {
	DB       *gorm.DB
	Cache    cache.Cmdable
	IDGen    idgen.IDGenerator
	Storage  storage.Storage
	User     *user.UserApplicationService
	Memory   *memory.MemoryApplicationServices
	Workflow *appworkflow.ApplicationService
}

func Init(ctx context.Context) (*Dependencies, error) {
	ctx = ctxcache.Init(ctx)
	setWorkflowDefaults()

	oss, err := storageImpl.New(ctx)
	if err != nil {
		return nil, err
	}
	seedDefaultAssets(ctx, oss)

	db, err := mysqlImpl.New()
	if err != nil {
		return nil, err
	}

	cacheCli := redisImpl.New()
	idGen, err := idgenImpl.New(cacheCli)
	if err != nil {
		return nil, err
	}

	eventBus := noopResourceEventBus{}
	userSVC := user.InitService(ctx, db, oss, idGen)
	memorySVC := memory.InitService(&memory.ServiceComponents{
		IDGen:                  idGen,
		DB:                     db,
		EventBus:               eventBus,
		TosClient:              oss,
		ResourceDomainNotifier: eventBus,
		CacheCli:               cacheCli,
	})

	permissionSVC := permission.InitService(&permission.ServiceComponents{})
	crosspermission.SetDefaultSVC(permissionImpl.InitDomainService(permissionSVC.DomainSVC))
	crossuser.SetDefaultSVC(userImpl.InitDomainService(userSVC.DomainSVC))
	crossvariables.SetDefaultSVC(variablesImpl.InitDomainService(memorySVC.VariablesDomainSVC))
	crossdatabase.SetDefaultSVC(databaseImpl.InitDomainService(memorySVC.DatabaseDomainSVC))

	workflowSVC, err := appworkflow.InitService(ctx, &appworkflow.ServiceComponents{
		IDGen:              idGen,
		DB:                 db,
		Cache:              cacheCli,
		DatabaseDomainSVC:  memorySVC.DatabaseDomainSVC,
		VariablesDomainSVC: memorySVC.VariablesDomainSVC,
		DomainNotifier:     eventBus,
		Tos:                oss,
		CPStore:            checkpoint.NewRedisStore(cacheCli),
		NodeSet:            entity.MirapNodeSet,
	})
	if err != nil {
		return nil, err
	}
	crossworkflow.SetDefaultSVC(workflowImpl.InitDomainService(workflowSVC.DomainSVC))

	return &Dependencies{
		DB:       db,
		Cache:    cacheCli,
		IDGen:    idGen,
		Storage:  oss,
		User:     userSVC,
		Memory:   memorySVC,
		Workflow: workflowSVC,
	}, nil
}

func seedDefaultAssets(ctx context.Context, st storage.Storage) {
	sourceDir := os.Getenv("WORKFLOW_DEFAULT_ASSET_DIR")
	if sourceDir == "" {
		sourceDir = "../docker/volumes/minio/default_icon"
	}

	absSourceDir, err := filepath.Abs(sourceDir)
	if err != nil {
		logs.CtxWarnf(ctx, "resolve default asset dir failed: %v", err)
		return
	}
	if stat, err := os.Stat(absSourceDir); err != nil || !stat.IsDir() {
		logs.CtxWarnf(ctx, "skip default asset seed, dir unavailable: %s", absSourceDir)
		return
	}

	err = filepath.WalkDir(absSourceDir, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}

		rel, err := filepath.Rel(absSourceDir, path)
		if err != nil {
			return err
		}
		key := "default_icon/" + filepath.ToSlash(rel)
		if _, err = st.HeadObject(ctx, key); err == nil {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		err = st.PutObjectWithReader(ctx, key, file)
		closeErr := file.Close()
		if err != nil {
			return err
		}
		return closeErr
	})
	if err != nil {
		logs.CtxWarnf(ctx, "seed default assets failed: %v", err)
		return
	}

	logs.CtxInfof(ctx, "default assets seeded from %s", absSourceDir)
}

func setWorkflowDefaults() {
	if os.Getenv(consts.StorageType) == "" {
		_ = os.Setenv(consts.StorageType, "local")
	}
	if os.Getenv("STORAGE_ROOT") == "" {
		_ = os.Setenv("STORAGE_ROOT", "./storage")
	}
}

type noopResourceEventBus struct{}

func (noopResourceEventBus) PublishResources(context.Context, *searchentity.ResourceDomainEvent) error {
	return nil
}

var _ searchsvc.ResourceEventBus = noopResourceEventBus{}
