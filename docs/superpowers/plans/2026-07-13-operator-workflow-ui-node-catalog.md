# 算子工作流前端汉化与节点目录规范实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 Coze Studio 原有视觉和交互逻辑的前提下，完成六个自定义节点的 ID 分段与分类排序、隐藏“知识库&数据”添加入口、默认中文和“算子工作流”品牌文案替换。

**Architecture:** 后端 `NodeTypeMetas` 继续作为节点持久化 ID 与分类目录的权威来源，前端 `StandardNodeType` 和 Registry 引用相同 ID。添加面板继续使用现有 enabled-node-types 过滤和后端分类顺序；默认语言和品牌文案继续使用现有 i18n 系统，不增加 DOM 替换层或新主题。

**Tech Stack:** Go 1.24、React 18、TypeScript 5.8、Vitest 3、Rush 5、Coze Design、现有 I18n 资源系统。

## Global Constraints

- 首次访问默认使用简体中文，同时保留原有语言切换与偏好记忆能力。
- 用户可见的 `Coze`、`Coze Studio` 和 `扣子`品牌文案统一替换为“算子工作流”。
- 不修改内部包名、导入路径、代码变量、类型名称、埋点标识、接口字段、版权头或内部注释。
- 不重构页面布局、工具栏、画布、节点卡片或配置面板交互。
- 不更换组件库、主题色、字体、图标体系或动效体系。
- 不为旧的 `1002` 至 `1006` 节点类型提供兼容、迁移或回退逻辑。
- `WorkflowNodeRegistry.type`、`meta.nodeDTOType` 与后端 `NodeTypeMetas.ID` 必须一致。
- 实现开始前先执行 modern-web-guidance 搜索，并按 superpowers:test-driven-development 先写失败测试。
- 不提交 `.superpowers/` 视觉讨论临时文件。

---

### Task 1: 后端节点 ID、分类与目录顺序

**Files:**
- Modify: `backend/domain/workflow/entity/node_meta.go:205`
- Modify: `backend/domain/workflow/entity/node_meta.go:980`
- Modify: `backend/domain/workflow/entity/node_meta_mirap_test.go`

**Interfaces:**
- Consumes: `Categories`、`NodeTypeMetas`、`NodeMetaByNodeType`。
- Produces: HTTP 封装节点 `1001–1003`、MMSI 节点 `2001–2003`，以及有序分类 `operator`、`operator_logic`。

- [ ] **Step 1: 编写失败的后端元数据契约测试**

在 `node_meta_mirap_test.go` 增加：

```go
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
```

若 `NodeTypeMeta.ID` 的实际类型不是 `int64`，测试表的 `id` 使用该字段的精确整数类型。

- [ ] **Step 2: 运行测试并确认旧元数据导致失败**

Run: `cd backend && go test ./domain/workflow/entity -run 'TestMirap(CustomNodeMetadata|CategoryOrder)$' -count=1`

Expected: FAIL，至少报告 `MirapStayCalculation ID = 1005, want 1002` 或 `Categories[1]` 仍为 `logic`。

- [ ] **Step 3: 实现后端分类与 ID 映射**

让 `Categories` 前三项为：

```go
{Key: "", Name: "", EnUSName: ""},
{Key: "operator", Name: "算子", EnUSName: "Operator"},
{Key: "operator_logic", Name: "算子业务逻辑", EnUSName: "Operator logic"},
```

把原 `logic` 及后续分类接在其后并保持原相对顺序，删除末尾原 `operator` 重复项。只修改六个既有 `NodeTypeMetas` 条目的 `ID` 和 `Category`：

```text
MirapAreaShipExtractor  1001  operator
MirapStayCalculation    1002  operator
MirapHoverDetail        1003  operator
MirapMMSIIntersection   2001  operator_logic
MirapMMSIUnion          2002  operator_logic
MirapMMSIDifference     2003  operator_logic
```

保留各条目的 Key、名称、描述、颜色、图标和 `ExecutableMeta`。

- [ ] **Step 4: 格式化并验证**

Run: `gofmt -w backend/domain/workflow/entity/node_meta.go backend/domain/workflow/entity/node_meta_mirap_test.go`

Run: `cd backend && go test ./domain/workflow/entity ./application/workflow -count=1`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add backend/domain/workflow/entity/node_meta.go backend/domain/workflow/entity/node_meta_mirap_test.go
git commit -m "feat(workflow): separate operator node metadata"
```

---

### Task 2: 前端节点 ID 与 Registry 持久化契约

**Files:**
- Modify: `frontend/packages/workflow/base/src/types/node-type.ts`
- Modify: `frontend/packages/workflow/base/__tests__/types/node-type.test.ts`
- Create: `frontend/packages/workflow/playground/src/node-registries/__tests__/mirap-node-registries.test.ts`

**Interfaces:**
- Consumes: Task 1 的六个后端 ID。
- Produces: 相同的 `StandardNodeType` 值和 Registry `type === nodeDTOType` 契约。

- [ ] **Step 1: 在基础包测试中声明新 ID**

```ts
it('应该为 Mirap 自定义节点使用分组后的稳定 ID', () => {
  expect(StandardNodeType.MirapAreaShipExtractor).toBe('1001');
  expect(StandardNodeType.MirapStayCalculation).toBe('1002');
  expect(StandardNodeType.MirapHoverDetail).toBe('1003');
  expect(StandardNodeType.MirapMMSIIntersection).toBe('2001');
  expect(StandardNodeType.MirapMMSIUnion).toBe('2002');
  expect(StandardNodeType.MirapMMSIDifference).toBe('2003');
});
```

- [ ] **Step 2: 新增 Registry 契约测试**

新建 `mirap-node-registries.test.ts`，使用仓库标准版权头：

```ts
import { describe, expect, it } from 'vitest';
import { StandardNodeType } from '@coze-workflow/base';

import { MIRAP_STAY_CALC_NODE_REGISTRY } from '../mirap-stay-calc';
import {
  MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY,
  MIRAP_MMSI_INTERSECTION_NODE_REGISTRY,
  MIRAP_MMSI_UNION_NODE_REGISTRY,
} from '../mirap-mmsi-set';
import { MIRAP_HOVER_DETAIL_NODE_REGISTRY } from '../mirap-hover-detail';
import { MIRAP_AREA_SHIP_NODE_REGISTRY } from '../mirap-area-ship';

describe('Mirap node registry persistence contract', () => {
  it.each([
    [MIRAP_AREA_SHIP_NODE_REGISTRY, StandardNodeType.MirapAreaShipExtractor],
    [MIRAP_STAY_CALC_NODE_REGISTRY, StandardNodeType.MirapStayCalculation],
    [MIRAP_HOVER_DETAIL_NODE_REGISTRY, StandardNodeType.MirapHoverDetail],
    [MIRAP_MMSI_INTERSECTION_NODE_REGISTRY, StandardNodeType.MirapMMSIIntersection],
    [MIRAP_MMSI_UNION_NODE_REGISTRY, StandardNodeType.MirapMMSIUnion],
    [MIRAP_MMSI_DIFFERENCE_NODE_REGISTRY, StandardNodeType.MirapMMSIDifference],
  ])('keeps registry type and nodeDTOType aligned', (registry, nodeType) => {
    expect(registry.type).toBe(nodeType);
    expect(registry.meta.nodeDTOType).toBe(nodeType);
  });
});
```

- [ ] **Step 3: 确认测试失败**

Run: `cd frontend/packages/workflow/base && rushx test -- __tests__/types/node-type.test.ts`

Expected: FAIL，旧枚举仍返回 `1005` 等值。

- [ ] **Step 4: 修改枚举**

```ts
MirapAreaShipExtractor = '1001',
MirapStayCalculation = '1002',
MirapHoverDetail = '1003',
MirapMMSIIntersection = '2001',
MirapMMSIUnion = '2002',
MirapMMSIDifference = '2003',
```

四个 Registry 源文件已经引用枚举，无需修改。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend/packages/workflow/base && rushx test -- __tests__/types/node-type.test.ts`

Run: `cd frontend/packages/workflow/playground && rushx test -- src/node-registries/__tests__/mirap-node-registries.test.ts src/node-registries/mirap-mmsi-set/__tests__`

Expected: PASS。

```bash
git add frontend/packages/workflow/base/src/types/node-type.ts frontend/packages/workflow/base/__tests__/types/node-type.test.ts frontend/packages/workflow/playground/src/node-registries/__tests__/mirap-node-registries.test.ts
git commit -m "feat(workflow): align custom node type ranges"
```

---

### Task 3: 添加面板保留原分类并隐藏“知识库&数据”

**Files:**
- Modify: `frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts`
- Modify: `frontend/packages/workflow/adapter/base/__tests__/get-enabled-node-types.test.ts`

**Interfaces:**
- Consumes: Task 1 的分类顺序与 Task 2 的自定义类型。
- Produces: 当前添加面板节点集合减去 `VariableAssign`；循环局部节点行为不变。

- [ ] **Step 1: 增加失败测试**

在默认场景加入：

```ts
expect(enabled).not.toContain(StandardNodeType.VariableAssign);
expect(enabled).toEqual(
  expect.arrayContaining([
    StandardNodeType.Start,
    StandardNodeType.End,
    StandardNodeType.If,
    StandardNodeType.Loop,
    StandardNodeType.Input,
    StandardNodeType.Output,
    StandardNodeType.Http,
    StandardNodeType.Comment,
    StandardNodeType.MirapAreaShipExtractor,
    StandardNodeType.MirapStayCalculation,
    StandardNodeType.MirapHoverDetail,
    StandardNodeType.MirapMMSIIntersection,
    StandardNodeType.MirapMMSIUnion,
    StandardNodeType.MirapMMSIDifference,
  ]),
);
```

增加循环场景：

```ts
it('hides the data entry while preserving loop-scoped controls', () => {
  const { getEnabledNodeTypes } = enabledNodeTypesModule;
  const enabled = getEnabledNodeTypes({ ...params, loopSelected: true });
  expect(enabled).not.toContain(StandardNodeType.VariableAssign);
  expect(enabled).toContain(StandardNodeType.Break);
  expect(enabled).toContain(StandardNodeType.Continue);
  expect(enabled).toContain(StandardNodeType.SetVariable);
});
```

- [ ] **Step 2: 确认测试失败**

Run: `cd frontend/packages/workflow/adapter/base && rushx test -- __tests__/get-enabled-node-types.test.ts`

Expected: FAIL，返回值仍包含 `VariableAssign`。

- [ ] **Step 3: 最小实现**

只从 `MIRAP_BASE_NODE_TYPES` 删除：

```ts
StandardNodeType.VariableAssign,
```

保留后端 `MirapNodeSet`、`NODES_V2` 和变量赋值 Registry，使隐藏只影响添加面板。把注释改为“添加面板白名单”，不再描述为执行白名单。

- [ ] **Step 4: 验证并提交**

Run: `cd frontend/packages/workflow/adapter/base && rushx test -- __tests__/get-enabled-node-types.test.ts`

Expected: PASS。

```bash
git add frontend/packages/workflow/adapter/base/src/utils/get-enabled-node-types.ts frontend/packages/workflow/adapter/base/__tests__/get-enabled-node-types.test.ts
git commit -m "feat(workflow): hide data nodes from add panel"
```

---

### Task 4: 默认中文并保留语言偏好

**Files:**
- Create: `frontend/apps/coze-studio/src/utils/initial-language.ts`
- Create: `frontend/apps/coze-studio/src/utils/__tests__/initial-language.test.ts`
- Modify: `frontend/apps/coze-studio/src/index.tsx`
- Create: `frontend/packages/foundation/global-adapter/src/components/global-layout/locale.ts`
- Create: `frontend/packages/foundation/global-adapter/src/components/global-layout/locale.test.ts`
- Modify: `frontend/packages/foundation/global-adapter/src/components/global-layout/index.tsx`

**Interfaces:**
- Consumes: `localStorage.i18next`、`userInfo.locale`、`I18n.language`。
- Produces: `getInitialLanguage()` 和 `resolveCurrentLocale()` 两个纯函数。

- [ ] **Step 1: 编写失败测试**

`initial-language.test.ts` 使用标准版权头并包含：

```ts
import { describe, expect, it } from 'vitest';
import { getInitialLanguage } from '../initial-language';

describe('getInitialLanguage', () => {
  it('defaults to zh-CN without a saved preference', () => {
    expect(getInitialLanguage({ getItem: () => null })).toBe('zh-CN');
  });
  it('preserves saved language preferences', () => {
    expect(getInitialLanguage({ getItem: () => 'en' })).toBe('en');
    expect(getInitialLanguage({ getItem: () => 'zh-CN' })).toBe('zh-CN');
  });
});
```

`locale.test.ts` 使用标准版权头并包含：

```ts
import { describe, expect, it } from 'vitest';
import { resolveCurrentLocale } from './locale';

describe('resolveCurrentLocale', () => {
  it('uses explicit user locale first', () => {
    expect(resolveCurrentLocale('en-US', 'zh-CN')).toBe('en-US');
  });
  it('defaults providers to Chinese', () => {
    expect(resolveCurrentLocale(undefined, 'zh-CN')).toBe('zh-CN');
  });
  it('preserves saved English for providers', () => {
    expect(resolveCurrentLocale(undefined, 'en')).toBe('en-US');
  });
});
```

- [ ] **Step 2: 确认测试因模块不存在而失败**

Run: `cd frontend/apps/coze-studio && rushx test -- src/utils/__tests__/initial-language.test.ts`

Run: `cd frontend/packages/foundation/global-adapter && rushx test -- src/components/global-layout/locale.test.ts`

Expected: FAIL，找不到两个新模块。

- [ ] **Step 3: 实现纯函数**

```ts
// initial-language.ts
export type SupportedLanguage = 'en' | 'zh-CN';

export const getInitialLanguage = (
  storage: Pick<Storage, 'getItem'>,
): SupportedLanguage =>
  storage.getItem('i18next') === 'en' ? 'en' : 'zh-CN';
```

```ts
// locale.ts
export type ComponentLocale = 'en-US' | 'zh-CN';

export const resolveCurrentLocale = (
  userLocale: string | undefined,
  i18nLanguage: string,
): ComponentLocale => {
  if (userLocale === 'en-US' || userLocale === 'en') {
    return 'en-US';
  }
  if (userLocale) {
    return 'zh-CN';
  }
  return i18nLanguage === 'en' ? 'en-US' : 'zh-CN';
};
```

两个实现文件使用仓库标准版权头。

- [ ] **Step 4: 接入现有初始化**

`frontend/apps/coze-studio/src/index.tsx` 使用：

```ts
initI18nInstance({ lng: getInitialLanguage(localStorage) });
```

删除 `IS_OVERSEA ? 'en' : 'zh-CN'` 默认分支。`global-layout/index.tsx` 使用：

```ts
const currentLocale = resolveCurrentLocale(userInfo?.locale, I18n.language);
```

保留现有 `I18n.setLang`、两个 LocaleProvider 和 localStorage 持久化逻辑。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend/apps/coze-studio && rushx test -- src/utils/__tests__/initial-language.test.ts`

Run: `cd frontend/packages/foundation/global-adapter && rushx test -- src/components/global-layout/locale.test.ts`

Expected: PASS。

```bash
git add frontend/apps/coze-studio/src/index.tsx frontend/apps/coze-studio/src/utils frontend/packages/foundation/global-adapter/src/components/global-layout
git commit -m "feat(frontend): default operator workflow to Chinese"
```

---

### Task 5: 用户可见品牌文案最小替换

**Files:**
- Modify: `frontend/apps/coze-studio/index.html`
- Modify: `frontend/packages/arch/resources/studio-i18n-resource/package.json`
- Modify: `frontend/packages/arch/resources/studio-i18n-resource/src/locales/zh-CN.json`
- Modify: `frontend/packages/arch/resources/studio-i18n-resource/src/locales/en.json`
- Create: `frontend/packages/arch/resources/studio-i18n-resource/__tests__/operator-workflow-branding.test.ts`

**Interfaces:**
- Consumes: `open_source_login_welcome`、`platform_name` 与静态 HTML 标题。
- Produces: 中英文模式下的产品名“算子工作流”。

- [ ] **Step 1: 启用现有 Vitest 配置并编写失败测试**

把资源包 `package.json` 中原先的空测试脚本改为：

```json
"test": "vitest --run --passWithNoTests",
"test:cov": "npm run test -- --coverage"
```

新测试使用标准版权头：

```ts
import { describe, expect, it } from 'vitest';
import zhCN from '../src/locales/zh-CN.json';
import en from '../src/locales/en.json';

describe('operator workflow visible branding', () => {
  it('uses the operator workflow name in Chinese', () => {
    expect(zhCN.platform_name).toBe('算子工作流');
    expect(zhCN.open_source_login_welcome).toBe('欢迎使用算子工作流');
  });
  it('does not restore Coze branding in English', () => {
    expect(en.platform_name).toBe('算子工作流');
    expect(en.open_source_login_welcome).toBe('Welcome to 算子工作流');
  });
});
```

- [ ] **Step 2: 确认旧资源导致失败**

Run: `cd frontend/packages/arch/resources/studio-i18n-resource && rushx test -- __tests__/operator-workflow-branding.test.ts`

Expected: FAIL，旧值仍包含“扣子”或 `Coze`。

- [ ] **Step 3: 修改精确资源与标题**

`index.html`：

```html
<html lang="zh-CN">
<title>算子工作流</title>
```

`zh-CN.json`：

```json
"open_source_login_welcome": "欢迎使用算子工作流",
"platform_name": "算子工作流"
```

`en.json`：

```json
"open_source_login_welcome": "Welcome to 算子工作流",
"platform_name": "算子工作流"
```

不修改 `CozeBrand` 图标组件、内部资源 key、外部 GitHub 协议链接或包名。

- [ ] **Step 4: 验证并提交**

Run: `cd frontend/packages/arch/resources/studio-i18n-resource && rushx test -- __tests__/operator-workflow-branding.test.ts`

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/zh-CN.json')); JSON.parse(require('fs').readFileSync('src/locales/en.json'))"`

Expected: PASS。

```bash
git add frontend/apps/coze-studio/index.html frontend/packages/arch/resources/studio-i18n-resource/package.json frontend/packages/arch/resources/studio-i18n-resource/src/locales/zh-CN.json frontend/packages/arch/resources/studio-i18n-resource/src/locales/en.json frontend/packages/arch/resources/studio-i18n-resource/__tests__/operator-workflow-branding.test.ts
git commit -m "feat(frontend): rename visible product branding"
```

---

### Task 6: 集成验证、保存重开与最小视觉回归

**Files:**
- Verify: Tasks 1–5 的全部文件。

**Interfaces:**
- Consumes: 新节点契约、分类顺序、面板过滤、语言与品牌资源。
- Produces: 自动化测试、构建和浏览器回归证据，不新增主题代码。

- [ ] **Step 1: 运行后端相关测试**

Run: `cd backend && go test ./domain/workflow/entity ./domain/workflow/internal/nodes/mirapareaship ./domain/workflow/internal/nodes/mirapstaycalc ./domain/workflow/internal/nodes/miraphoverdetail ./domain/workflow/internal/nodes/mirapmmsiset ./application/workflow -count=1`

Expected: PASS。

- [ ] **Step 2: 运行受影响前端包测试**

```bash
cd frontend/packages/workflow/base && rushx test -- __tests__/types/node-type.test.ts
cd ../adapter/base && rushx test -- __tests__/get-enabled-node-types.test.ts
cd ../../playground && rushx test -- src/node-registries/__tests__/mirap-node-registries.test.ts src/node-registries/mirap-mmsi-set/__tests__
cd ../../../apps/coze-studio && rushx test -- src/utils/__tests__/initial-language.test.ts
cd ../../packages/foundation/global-adapter && rushx test -- src/components/global-layout/locale.test.ts
cd ../../arch/resources/studio-i18n-resource && rushx test -- __tests__/operator-workflow-branding.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 3: 运行静态检查与构建**

```bash
cd frontend/packages/workflow/base && rushx lint
cd ../adapter/base && rushx lint
cd ../../playground && rushx lint
cd ../../foundation/global-adapter && rushx lint
cd ../../arch/resources/studio-i18n-resource && rushx lint
cd ../../../../apps/coze-studio && rushx lint && rushx build
```

Expected: exit code 0。Node 24 的 Rush 未测试版本警告可以记录，但不能伴随失败。

- [ ] **Step 4: 浏览器验证语言与品牌**

启动后端和前端：`make server`，然后在 `frontend/apps/coze-studio` 运行 `npm run dev`。使用 Playwright 清除 `localStorage.i18next` 并刷新，预期登录页、输入框、登录、注册、协议均为中文，欢迎语和浏览器标题为“算子工作流”。切换英文并刷新，预期语言偏好被保留，品牌名仍为“算子工作流”。

- [ ] **Step 5: 浏览器验证添加面板**

打开新建工作流的添加节点面板，预期顺序为：原有无标题常用节点、算子、算子业务逻辑、业务逻辑、输入&输出、组件、其余已启用分类。预期“知识库&数据”和“变量赋值”不出现；原生“HTTP 请求”仍在“组件”；三个 HTTP 封装节点位于“算子”；MMSI 三节点位于“算子业务逻辑”。搜索“变量赋值”无结果，搜索六个自定义节点均能命中。

- [ ] **Step 6: 验证六个节点试运行、保存和重开**

添加六个节点并执行现有单节点试运行。保存、刷新和重新打开后，确认持久化类型依次为 `1001`、`1002`、`1003`、`2001`、`2002`、`2003`，节点仍恢复为原卡片和配置表单，不退化为原生 HTTP 或其他节点；拖拽、连线、复制、删除、工具栏和配置面板交互保持不变。

- [ ] **Step 7: 最终工作树检查**

Run: `git diff --check && git status --short && git log -5 --oneline`

Expected: `git diff --check` 无输出；只允许已说明的 `.superpowers/` 未跟踪文件，不遗漏业务文件；Tasks 1–5 各有对应提交。
