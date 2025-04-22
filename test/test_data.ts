/**
 * Structure to hold functional unit test data and descriptions
 *
 * @license
 * Copyright 2025 flufy3d All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JianpuInfo } from '../src/index';

/** Holds functional unit test data and descriptions */
export interface TestData {
  /** The concise title */
  title: string;
  /** The detailed description */
  description: string;
  /** The data */
  data: JianpuInfo;
}