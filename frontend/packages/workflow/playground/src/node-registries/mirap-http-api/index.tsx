/* Copyright 2025 coze-dev Authors. Licensed under the Apache License, Version 2.0. */
import { nanoid } from 'nanoid';
import { omit } from 'lodash-es';
import {
  FlowNodeFormData,
  ValidateTrigger,
  type FormMetaV2,
} from '@flowgram-adapter/free-layout-editor';
import {
  DEFAULT_NODE_META_PATH,
  DEFAULT_OUTPUTS_PATH,
  nodeUtils,
} from '@coze-workflow/nodes';
import {
  type StandardNodeType,
  ValueExpressionType,
  type NodeDataDTO,
  type ValueExpression,
  type WorkflowNodeRegistry,
} from '@coze-workflow/base';
import { I18n } from '@coze-arch/i18n';

import {
  generateParametersToProperties,
  type NodeTestMeta,
} from '@/test-run-kit';
import { nodeMetaValidate } from '@/nodes-v2/materials/node-meta-validate';
import { getInputIsEmpty } from '@/node-registries/trigger-upsert/utils';
import { FixedInputParameter } from '@/node-registries/trigger-upsert/components/fixed-input-parameter-field';
import { createValueExpressionInputValidate } from '@/node-registries/common/validators';
import { withNodeConfigForm } from '@/node-registries/common/hocs';
import {
  fireNodeTitleChange,
  provideNodeOutputVariablesEffect,
} from '@/node-registries/common/effects';
import { DataTypeTag } from '@/node-registries/common/components';
import { InputParameters, Outputs } from '@/node-registries/common/components';
import { Section } from '@/form';

import { MIRAP_HTTP_API_SPECS, type ApiField, type ApiSpec } from './catalog';

const INPUT_PATH = 'inputs.inputParameters';
const OUTPUT_INDENT = 16;

interface OutputDTO {
  key?: string;
  name?: string;
  type?: number;
  children?: OutputDTO[];
}

interface FormData extends Omit<NodeDataDTO, 'inputs'> {
  inputs: {
    inputParameters: Record<string, ValueExpression>;
  };
}

const createOutput = (field: ApiField, existing?: OutputDTO): OutputDTO => ({
  key: existing?.key ?? nanoid(),
  name: field.name,
  type: field.type,
  ...(field.children
    ? {
        children: field.children.map(child =>
          createOutput(
            child,
            existing?.children?.find(item => item.name === child.name),
          ),
        ),
      }
    : {}),
});
const createOutputs = (spec: ApiSpec, existing: OutputDTO[] = []) =>
  spec.outputs.map(field =>
    createOutput(
      field,
      existing.find(item => item.name === field.name),
    ),
  );
const defaultInputs = (spec: ApiSpec) =>
  Object.fromEntries(
    spec.inputs.map(field => [
      field.name,
      { type: ValueExpressionType.LITERAL },
    ]),
  );

const createTransformer = (spec: ApiSpec) => ({
  init(value: NodeDataDTO, context): FormData {
    if (!value) {
      const initial: FormData = {
        inputs: { inputParameters: defaultInputs(spec) },
        outputs: createOutputs(spec),
      };
      return initial;
    }
    const inputParameters: Record<string, ValueExpression> = {};
    (value.inputs?.inputParameters ?? []).forEach(item => {
      inputParameters[item.name as string] = nodeUtils.refExpressionDTOToVO(
        item,
        context,
      );
    });
    const initial: FormData = {
      ...value,
      outputs: createOutputs(spec, value.outputs),
      inputs: {
        ...omit(value.inputs ?? {}, ['inputParameters']),
        inputParameters: { ...defaultInputs(spec), ...inputParameters },
      },
    };
    return initial;
  },
  submit(value: FormData, context): NodeDataDTO {
    const inputParameters = Object.entries(value.inputs?.inputParameters ?? {})
      .filter(([, item]) => !!getInputIsEmpty(item))
      .map(([name, item]) => ({
        name,
        input: nodeUtils.refExpressionToValueDTO(
          item as ValueExpression,
          context,
        )?.input,
      }));
    const result: NodeDataDTO = {
      ...omit(value, ['inputs']),
      outputs: createOutputs(spec, value.outputs),
      inputs: {
        ...omit(value.inputs ?? {}, ['inputParameters']),
        inputParameters,
      },
    };
    return result;
  },
});

const OutputField = ({
  field,
  depth = 0,
}: {
  field: ApiField;
  depth?: number;
}) => (
  <>
    <div
      className="flex min-h-[28px] items-center justify-between gap-[8px]"
      style={{ paddingLeft: depth * OUTPUT_INDENT }}
    >
      <span className="text-[12px] coz-fg-secondary">{field.name}</span>
      <DataTypeTag type={field.type} />
    </div>
    {field.children?.map(child => (
      <OutputField key={child.name} field={child} depth={depth + 1} />
    ))}
  </>
);

const ApiForm = withNodeConfigForm(({ spec }: { spec: ApiSpec }) => (
  <>
    <Section title={I18n.t('workflow_detail_node_input', {}, '输入')}>
      <FixedInputParameter
        layout="horizontal"
        name={INPUT_PATH}
        fieldConfig={spec.inputs.map(field => ({
          ...field,
          label: field.name,
        }))}
      />
    </Section>
    <Section title={I18n.t('workflow_detail_node_output', {}, '输出')}>
      <div className="flex flex-col gap-[4px]">
        {spec.outputs.map(field => (
          <OutputField key={field.name} field={field} />
        ))}
      </div>
    </Section>
  </>
));

const createFormMeta = (spec: ApiSpec): FormMetaV2<FormData> => {
  const transformer = createTransformer(spec);
  const validate = Object.fromEntries(
    spec.inputs
      .filter(field => field.required)
      .map(field => [
        `${INPUT_PATH}.${field.name}`,
        createValueExpressionInputValidate({ required: true }),
      ]),
  );
  return {
    render: () => <ApiForm spec={spec} />,
    validateTrigger: ValidateTrigger.onChange,
    validate: { nodeMeta: nodeMetaValidate, ...validate },
    effect: {
      nodeMeta: fireNodeTitleChange,
      outputs: provideNodeOutputVariablesEffect,
    },
    formatOnInit: transformer.init,
    formatOnSubmit: transformer.submit,
  };
};

const createTest = (spec: ApiSpec): NodeTestMeta => ({
  generateFormInputProperties(node) {
    const formData = node
      .getData(FlowNodeFormData)
      .formModel.getFormItemValueByPath('/');
    const values = formData?.inputs?.inputParameters ?? {};
    return generateParametersToProperties(
      spec.inputs.map(field => ({
        name: field.name,
        title: field.name,
        required: !!field.required,
        input: values[field.name],
      })),
      { node },
    );
  },
});

const createRegistry = (spec: ApiSpec): WorkflowNodeRegistry<NodeTestMeta> => ({
  type: spec.type,
  meta: {
    nodeDTOType: spec.type,
    size: { width: 360, height: 240 },
    nodeMetaPath: DEFAULT_NODE_META_PATH,
    outputsPath: DEFAULT_OUTPUTS_PATH,
    inputParametersPath: INPUT_PATH,
    test: createTest(spec),
  },
  variablesMeta: { inputsPathList: [], outputsPathList: ['outputs'] },
  formMeta: createFormMeta(spec),
});

export const MIRAP_HTTP_API_NODE_REGISTRIES =
  MIRAP_HTTP_API_SPECS.map(createRegistry);
export const MIRAP_HTTP_API_NODE_TYPES = MIRAP_HTTP_API_SPECS.map(
  spec => spec.type,
);
export function MirapHttpApiContent() {
  return (
    <>
      <InputParameters />
      <Outputs />
    </>
  );
}

// Compile-time guard: every catalogue entry must be a real persisted node type.
const _nodeTypes: StandardNodeType[] = MIRAP_HTTP_API_NODE_TYPES;
void _nodeTypes;
