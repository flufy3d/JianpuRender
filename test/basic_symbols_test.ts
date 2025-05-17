/**
 * Functional unit test set for rhythm splitting on jianpurender library.
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

/**
 * Imports
 */
import * as test from 'tape';
import { JianpuModel } from '../src/jianpu_model';

import * as bs from './basic_symbols_features';

test(`basic_symbols_test: ${bs.testData[0].title}`, (t: test.Test) => {
  const output = new JianpuModel(bs.testData[0].data);
  let score = output.jianpuBlockMap;
  t.equal(score.get( 8.0).length, 1, 'Quarter note length');
  t.equal(score.get(12.0).length, 0.5, 'Eigth note length');
  t.equal(score.get(16.0).length, 0.25, 'Sixteenth note length');
  t.equal(score.get(20.0).length, 0.125, 'Thirtysecondth note length');
  t.equal(score.get(24.0).length, 0.0625, 'Sixtyfourth note length');
  t.end();
});



// Testing in testData[1] is only visual.

test(`basic_symbols_test: ${bs.testData[2].title}`, (t: test.Test) => {
  const output = new JianpuModel(bs.testData[2].data);
  let score = output.jianpuBlockMap;
  t.equal(score.get(13.0 ).length, 1, 'Quarter note rest length');
  t.equal(score.get(14.0 ).length, 0.5, 'Eigth note rest length');
  t.equal(score.get(15.0 ).length, 0.25, 'Sixteenth note rest length');
  t.equal(score.get(15.5 ).length, 0.125, 'Thirtysecondth note rest length');
  t.equal(score.get(15.75).length, 0.0625, 'Sixtyfourth note rest length');
  t.end();
});
