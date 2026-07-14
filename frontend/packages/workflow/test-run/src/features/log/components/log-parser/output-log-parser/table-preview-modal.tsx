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

import React, { useMemo } from 'react';

import { I18n } from '@coze-arch/i18n';
import { Button, Modal, Typography } from '@coze-arch/coze-design';

import { type LogValueType } from '../../../types';

import css from './table-preview-modal.module.less';

type TableRow = Record<string, unknown>;

const VALUE_COLUMN = 'value';

const tryParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    // Invalid JSON strings are ordinary cell values and should be displayed as-is.
    void error;
    return value;
  }
};

export const getPreviewArray = (value: LogValueType): unknown[] | undefined => {
  const parsedValue = tryParseJson(value);

  if (Array.isArray(parsedValue)) {
    return parsedValue;
  }

  if (!parsedValue || typeof parsedValue !== 'object') {
    return undefined;
  }

  const record = parsedValue as Record<string, unknown>;
  const output = tryParseJson(record.output);
  if (Array.isArray(output)) {
    return output;
  }

  return Object.values(record).map(tryParseJson).find(Array.isArray);
};

const normalizeRows = (data: unknown[]): TableRow[] =>
  data.map(item => {
    const parsedItem = tryParseJson(item);
    return parsedItem &&
      typeof parsedItem === 'object' &&
      !Array.isArray(parsedItem)
      ? (parsedItem as TableRow)
      : { [VALUE_COLUMN]: parsedItem };
  });

const stringifyCell = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      // Circular objects cannot be serialized; String still gives a safe preview.
      void error;
      return String(value);
    }
  }
  return String(value);
};

interface TablePreviewModalProps {
  visible: boolean;
  data: unknown[];
  onClose: () => void;
}

export const TablePreviewModal: React.FC<TablePreviewModalProps> = ({
  visible,
  data,
  onClose,
}) => {
  const rows = useMemo(() => normalizeRows(data), [data]);
  const columns = useMemo(
    () => Array.from(new Set(rows.flatMap(row => Object.keys(row)))),
    [rows],
  );

  return (
    <Modal
      className={css.modal}
      visible={visible}
      title={I18n.t('creat_project_use_template_preview')}
      width="80vw"
      centered
      maskClosable={false}
      getPopupContainer={() => document.body}
      onCancel={onClose}
      footer={
        <Button color="primary" onClick={onClose}>
          {I18n.t('Close', {}, '关闭')}
        </Button>
      }
    >
      <div className={css.summary}>{rows.length} 条数据</div>
      <div className={css['table-scroll']}>
        <table className={css.table}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column} scope="col">
                  <Typography.Text ellipsis={{ showTooltip: true }}>
                    {column}
                  </Typography.Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map(column => {
                  const value = stringifyCell(row[column]);
                  return (
                    <td key={column}>
                      <Typography.Text ellipsis={{ showTooltip: true }}>
                        {value}
                      </Typography.Text>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
