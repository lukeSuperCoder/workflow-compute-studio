/*
 * Copyright 2025 coze-dev Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { ValueExpressionType, type InputValueVO } from '@coze-workflow/base';

import { withNodeConfigForm } from '@/node-registries/common/hocs';
import { InputsField } from '@/node-registries/common/fields';
import { useWatch } from '@/form';

import {
  INPUT_PATH,
  arrayObjectOnlyDisabledTypes,
  createInputName,
} from './constants';

export const FormRender = withNodeConfigForm(() => {
  const inputs = useWatch<InputValueVO[]>(INPUT_PATH) ?? [];
  return (
    <InputsField
      name={INPUT_PATH}
      title="输入结果集"
      paramsTitle="结果集"
      expressionTitle="上游数组"
      defaultValue={[defaultInputParameter(0)]}
      onAppend={() => defaultInputParameter(inputs.length)}
      literalDisabled={true}
      inputProps={{
        disabledTypes: arrayObjectOnlyDisabledTypes,
        literalDisabled: true,
      }}
      nameProps={{ readonly: true }}
    />
  );
});

const defaultInputParameter = (index: number): InputValueVO => ({
  name: createInputName(index),
  input: { type: ValueExpressionType.REF },
});
