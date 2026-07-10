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

import { variableUtils } from '@coze-workflow/variable';
import {
  ValueExpressionType,
  ViewVariableType,
  type InputValueVO,
  type ValueExpression,
  type VariableMetaDTO,
} from '@coze-workflow/base';

import {
  type OutputFieldGroup,
  type OutputFieldMeta,
  type SelectedOutputGroup,
} from './types';
import {
  DEFAULT_RESULT_FIELDS,
  MMSI_FIELD,
  createInputName,
} from './constants';

export const normalizeInputParameters = (
  inputParameters?: InputValueVO[],
): InputValueVO[] =>
  (inputParameters?.length ? inputParameters : [{ name: createInputName(0) }])
    .filter(Boolean)
    .map((item, index) => ({
      ...item,
      name: item.name || createInputName(index),
      input: item.input || { type: ValueExpressionType.REF },
    }));

export const normalizeSelectedGroups = (
  rawGroups: SelectedOutputGroup[] | undefined,
  fieldGroups: OutputFieldGroup[],
  differenceMainInputName?: string,
): SelectedOutputGroup[] => {
  const rawMap = new Map(
    (rawGroups ?? []).map(group => [group.inputName, new Set(group.fields)]),
  );
  return fieldGroups.map(group => {
    if (
      differenceMainInputName &&
      group.inputName !== differenceMainInputName
    ) {
      return {
        inputName: group.inputName,
        fields: [MMSI_FIELD],
      };
    }

    const raw = rawMap.get(group.inputName);
    const fields = group.fields
      .filter(field => field.name === MMSI_FIELD || raw?.has(field.name))
      .map(field => field.name);
    if (!fields.includes(MMSI_FIELD)) {
      fields.unshift(MMSI_FIELD);
    }
    return {
      inputName: group.inputName,
      fields:
        raw && raw.size > 0 ? fields : group.fields.map(field => field.name),
    };
  });
};

export const buildFieldGroups = (
  inputParameters: InputValueVO[],
  getMeta: (input: InputValueVO) => {
    title?: string;
    dtoMeta?: unknown;
    viewMeta?: unknown;
  },
): OutputFieldGroup[] =>
  inputParameters.map((input, index) => {
    const inputName = input.name || createInputName(index);
    const meta = safeGetMeta(input, getMeta);
    const fields = extractArrayObjectFields(
      input.input,
      meta.dtoMeta,
      meta.viewMeta,
    );
    return {
      inputName,
      title: meta.title || inputName,
      fields: ensureMMSIField(fields),
    };
  });

const safeGetMeta = (
  input: InputValueVO,
  getMeta: (input: InputValueVO) => {
    title?: string;
    dtoMeta?: unknown;
    viewMeta?: unknown;
  },
) => {
  try {
    return getMeta(input);
  } catch {
    return {};
  }
};

export const extractArrayObjectFields = (
  expression?: ValueExpression,
  dtoMeta?: unknown,
  viewMeta?: unknown,
): OutputFieldMeta[] => {
  const viewMetaFields = viewMetaToFields(viewMeta);
  if (viewMetaFields.length) {
    return ensureMMSIField(viewMetaFields);
  }

  const dtoMetaFields = dtoMetaToFields(dtoMeta);
  if (dtoMetaFields.length) {
    return ensureMMSIField(dtoMetaFields);
  }

  const dtoMetaRecord = asRecord(dtoMeta);
  const dtoSchema = asRecord(dtoMetaRecord?.schema);
  const expressionRecord = asRecord(expression);
  const rawMetaRecord = asRecord(expression?.rawMeta);
  const rawMetaDTORecord = asRecord(rawMetaRecord?.dtoMeta);
  const candidates = [
    dtoMetaRecord?.schema,
    dtoSchema?.schema,
    expressionRecord?.schema,
    expression?.rawMeta?.schema,
    rawMetaDTORecord?.schema,
    rawMetaRecord?.properties,
  ];

  for (const candidate of candidates) {
    const fields = schemaToFields(candidate);
    if (fields.length) {
      return ensureMMSIField(fields);
    }
  }

  return DEFAULT_RESULT_FIELDS;
};

const viewMetaToFields = (viewMeta: unknown): OutputFieldMeta[] => {
  const children = asRecord(viewMeta)?.children;
  if (!Array.isArray(children)) {
    return [];
  }
  return children
    .map(child => {
      const field = asRecord(child);
      return {
        name: field?.name,
        type: field?.type,
      };
    })
    .filter(
      (field): field is OutputFieldMeta =>
        typeof field.name === 'string' &&
        field.name.length > 0 &&
        typeof field.type === 'number',
    );
};

const dtoMetaToFields = (dtoMeta: unknown): OutputFieldMeta[] => {
  const dtoMetaRecord = asRecord(dtoMeta);
  if (!dtoMetaRecord?.type) {
    return [];
  }

  try {
    const viewMeta = variableUtils.dtoMetaToViewMeta(
      dtoMetaRecord as unknown as VariableMetaDTO,
    );
    return (viewMeta.children ?? [])
      .map(child => ({
        name: child.name,
        type: child.type,
      }))
      .filter(
        (field): field is OutputFieldMeta =>
          typeof field.name === 'string' && field.name.length > 0,
      );
  } catch {
    return [];
  }
};

const schemaToFields = (schema: unknown): OutputFieldMeta[] => {
  const schemaRecord = asRecord(schema);
  const fieldSchemas = Array.isArray(schema)
    ? schema
    : Array.isArray(schemaRecord?.children)
      ? schemaRecord.children
      : Array.isArray(schemaRecord?.schema)
        ? schemaRecord.schema
        : Array.isArray(schemaRecord?.properties)
          ? schemaRecord.properties
          : [];

  return fieldSchemas
    .map(rawField => {
      const field = asRecord(rawField);
      return {
        name: field?.name,
        type: dtoFieldToViewType(field ?? {}),
      };
    })
    .filter(
      (field): field is OutputFieldMeta =>
        typeof field.name === 'string' && field.name.length > 0,
    );
};

const ensureMMSIField = (fields: OutputFieldMeta[]): OutputFieldMeta[] => {
  const deduped = new Map<string, OutputFieldMeta>();
  for (const field of fields) {
    if (!deduped.has(field.name)) {
      deduped.set(field.name, field);
    }
  }
  const mmsi = deduped.get(MMSI_FIELD) ?? DEFAULT_RESULT_FIELDS[0];
  deduped.delete(MMSI_FIELD);
  return [mmsi, ...deduped.values()];
};

const dtoFieldToViewType = (
  field: Record<string, unknown>,
): ViewVariableType => {
  const type = field?.type;
  const childType = asRecord(field?.schema)?.type;
  if (typeof type === 'number') {
    return type;
  }
  if (type === 'integer' || type === 'int') {
    return ViewVariableType.Integer;
  }
  if (type === 'float' || type === 'number' || type === 'double') {
    return ViewVariableType.Number;
  }
  if (type === 'boolean') {
    return ViewVariableType.Boolean;
  }
  if (type === 'object') {
    return ViewVariableType.Object;
  }
  if (type === 'list') {
    if (childType === 'object') {
      return ViewVariableType.ArrayObject;
    }
    if (childType === 'integer' || childType === 'int') {
      return ViewVariableType.ArrayInteger;
    }
    if (childType === 'float' || childType === 'number') {
      return ViewVariableType.ArrayNumber;
    }
    if (childType === 'boolean') {
      return ViewVariableType.ArrayBoolean;
    }
    return ViewVariableType.ArrayString;
  }
  return ViewVariableType.String;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return undefined;
};
