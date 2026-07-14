/* Copyright 2025 coze-dev Authors. Licensed under the Apache License, Version 2.0. */
/* eslint-disable max-params -- mirrors the four columns in the API request tables */
import { StandardNodeType, ViewVariableType } from '@coze-workflow/base';

export interface ApiField {
  name: string;
  type: ViewVariableType;
  required?: boolean;
  description?: string;
  children?: ApiField[];
}
export interface ApiSpec {
  type: StandardNodeType;
  inputs: ApiField[];
  outputs: ApiField[];
}

const s = ViewVariableType.String;
const i = ViewVariableType.Integer;
const n = ViewVariableType.Number;
const input = (
  name: string,
  type: ViewVariableType,
  required: boolean,
  description: string,
): ApiField => ({ name, type, required, description });
const field = (name: string, type: ViewVariableType): ApiField => ({
  name,
  type,
});
const datas = (...children: ApiField[]): ApiField[] => [
  { name: 'datas', type: ViewVariableType.ArrayObject, children },
];
const mmsiOutputs: ApiField[] = [
  field('code', s),
  field('message', s),
  ...datas(field('mmsi', i)),
  field('count', i),
];
const date = (name: string, required = true) =>
  input(name, s, required, '日期，格式 yyyy-MM-dd');
const mmsi = (required: boolean) =>
  input('mmsi', s, required, '船舶 MMSI 列表，多个值以逗号分隔');
const points = input('points', s, false, '区域坐标点串');
const eventDetailFields = (...extra: ApiField[]): ApiField[] => [
  field('mmsi', i),
  field('beginTime', i),
  field('endTime', i),
  field('beginLon', n),
  field('beginLat', n),
  field('endLon', n),
  field('endLat', n),
  ...extra,
];
const eventDetail = (...extra: ApiField[]) =>
  datas(...eventDetailFields(...extra));

export const MIRAP_HTTP_API_SPECS: ApiSpec[] = [
  {
    type: StandardNodeType.MirapBogusFilter,
    inputs: [mmsi(true), date('startdate'), date('enddate')],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapBogusDetail,
    inputs: [mmsi(true), date('startdate'), date('enddate'), points],
    outputs: datas(
      field('shipId', i),
      field('mmsi', i),
      field('dateKey', s),
      field('lon', n),
      field('lat', n),
    ),
  },
  {
    type: StandardNodeType.MirapHoverFilter,
    inputs: [
      mmsi(false),
      date('startdate'),
      date('enddate'),
      input('minhour', i, false, '最小徘徊时长（小时）'),
      input('maxhour', i, false, '最大徘徊时长（小时）'),
      points,
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapHoverEventDetail,
    inputs: [
      mmsi(false),
      input('startdate', s, true, '开始时间'),
      input('enddate', s, true, '结束时间'),
      points,
    ],
    outputs: datas(
      field('shipId', i),
      ...eventDetailFields(field('duration', n)),
    ),
  },
  {
    type: StandardNodeType.MirapLeanFilter,
    inputs: [
      mmsi(true),
      input('bymmsi', s, false, '搭靠目标船 MMSI 列表'),
      date('begin_time'),
      date('end_time'),
      input('minhour', i, true, '最小搭靠时长（小时，≥0）'),
      input('maxhour', i, true, '最大搭靠时长（小时，≥0）'),
      points,
      input('vesselcategory', s, false, '子船类型，多个值以逗号分隔'),
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapLeanDetail,
    inputs: [
      mmsi(true),
      input('bymmsi_name', s, false, '搭靠目标船名称'),
      date('begin_time'),
      date('end_time'),
      points,
    ],
    outputs: datas(
      field('shipId', i),
      field('mmsi', i),
      field('beginTime', i),
      field('endTime', i),
      field('beginLon', n),
      field('beginLat', n),
      field('endLon', n),
      field('endLat', n),
      field('duration', n),
      field('enName', s),
      field('shipIdBy', i),
      field('mmsiBy', i),
      field('enNameBy', s),
      field('dwt', i),
      field('shipType', s),
      field('length', n),
      field('width', n),
      field('age', n),
    ),
  },
  {
    type: StandardNodeType.MirapRemainFilter,
    inputs: [
      mmsi(false),
      date('startdate'),
      date('enddate'),
      input('minhour', i, true, '最小停留时长（小时，≥1）'),
      input('maxhour', i, true, '最大停留时长（小时，≥1）'),
      points,
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapRemainDetail,
    inputs: [mmsi(false), date('startdate'), date('enddate'), points],
    outputs: datas(
      field('shipId', i),
      ...eventDetailFields(
        field('duration', n),
        field('beginPortId', i),
        field('endPortId', i),
      ),
    ),
  },
  {
    type: StandardNodeType.MirapRetraceFilter,
    inputs: [
      mmsi(true),
      date('startdate'),
      date('enddate'),
      input('minvalue', i, true, '最小折返次数（≥1）'),
      input('maxvalue', i, true, '最大折返次数（≥1）'),
      points,
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapSignalSpoofingDetail,
    inputs: [
      mmsi(true),
      input('starttime', i, true, '开始时间（UTC 秒级时间戳）'),
      input('endtime', i, true, '结束时间（UTC 秒级时间戳）'),
    ],
    outputs: datas(field('mmsi', i), field('utcBegin', i), field('utcEnd', i)),
  },
  {
    type: StandardNodeType.MirapFakeSignalRecover,
    inputs: [mmsi(true)],
    outputs: datas(
      field('mmsi', i),
      field('realTime', s),
      field('realLon', n),
      field('realLat', n),
    ),
  },
  {
    type: StandardNodeType.MirapTrajectoryQuality,
    inputs: [
      date('startdate'),
      date('enddate'),
      input('minvalue', n, true, '轨迹质量指数最小值'),
      input('maxvalue', n, true, '轨迹质量指数最大值'),
      mmsi(true),
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapInterruptFilter,
    inputs: [
      date('startdate'),
      date('enddate'),
      input('minhour', i, true, '最小消失时长（小时）'),
      input('maxhour', i, true, '最大消失时长（小时）'),
      mmsi(false),
      points,
      input('sog_ratio', n, false, '速度比值'),
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapRepetitionFilter,
    inputs: [
      date('startdate'),
      date('enddate'),
      input('minhour', i, true, '最小时长（小时）'),
      input('maxhour', i, true, '最大时长（小时）'),
      mmsi(false),
      points,
      input('sog_ratio', n, false, '速度比值'),
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapInterruptDetail,
    inputs: [
      date('startdate'),
      date('enddate'),
      mmsi(false),
      points,
      input('sog_ratio', n, false, '速度比值'),
    ],
    outputs: eventDetail(
      field('distGap', n),
      field('speedGap', n),
      field('duration', n),
    ),
  },
  {
    type: StandardNodeType.MirapLowVelocityDetail,
    inputs: [date('startdate'), date('enddate'), mmsi(true), points],
    outputs: eventDetail(
      field('beginPortId', i),
      field('endPortId', i),
      field('duration', n),
    ),
  },
  {
    type: StandardNodeType.MirapSpeedFilter,
    inputs: [
      date('startdate'),
      date('endDate'),
      mmsi(false),
      input('minknot', i, true, '最小速度（节）'),
      input('maxknot', i, true, '最大速度（节）'),
      points,
    ],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapNoRegularFilter,
    inputs: [mmsi(true)],
    outputs: mmsiOutputs,
  },
  {
    type: StandardNodeType.MirapOnlineRatioFilter,
    inputs: [
      date('startdate'),
      date('enddate'),
      input('minvalue', n, true, '在线率区间最小值'),
      input('maxvalue', n, true, '在线率区间最大值'),
      mmsi(true),
    ],
    outputs: mmsiOutputs,
  },
];
