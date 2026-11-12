/* Surface samples from attributed anatomical meshes.
 * Source/changes: vascular-sources.html and assets/vascular/pointcloud-build.json.
 */
(() => {
  'use strict';
  const cache = new Map();
  const palettes = {
    cerebral: [[.63, .74, .80], [.51, .68, .72], [.70, .75, .67], [.82, .40, .30]],
    pulmonary: [[.38, .71, .94], [.94, .55, .50]]
  };

  function binary(encoded) {
    const value = atob(encoded);
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index);
    return bytes;
  }

  function decode(name) {
    if (cache.has(name)) return cache.get(name);
    const source = window.VascularPointData?.[name];
    if (!source || !Number.isInteger(source.count) || source.count <= 0) throw new Error('Point-cloud source data is unavailable');
    const coordinates = binary(source.positions);
    const labels = binary(source.labels);
    if (coordinates.length !== source.count * 6 || labels.length !== source.count) throw new Error('Point-cloud buffer sizes do not match');
    const view = new DataView(coordinates.buffer);
    const positions = new Float32Array(source.count * 3);
    for (let index = 0; index < positions.length; index++) positions[index] = view.getInt16(index * 2, true) / 32767;
    const normals = new Float32Array(source.count * 3);
    if (source.normals !== undefined) {
      const encodedNormals = binary(source.normals);
      if (encodedNormals.length !== normals.length) throw new Error('Point-cloud normal buffer size does not match');
      for (let index = 0; index < normals.length; index++) normals[index] = (encodedNormals[index] < 128 ? encodedNormals[index] : encodedNormals[index]-256) / 127;
    }
    const result = { positions, normals, labels, count: source.count, source: source.source, license: source.license };
    cache.set(name, result);
    return result;
  }

  function createScene(name, density = 1) {
    if (name === 'aneurysm') name = 'cerebral';
    if (!Object.hasOwn(palettes, name)) throw new RangeError(`Unknown vascular scene: ${name}`);
    if (!Number.isFinite(density) || density <= 0) throw new RangeError('Density must be a positive finite number');
    const source = decode(name);
    // Subsample existing surface points. Never interpolate branches, duplicate
    // meshes, or normalize the artery/vein groups independently.
    const count = Math.max(1, Math.round(source.count * Math.max(.1, Math.min(1, density))));
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      const original = Math.floor(index * source.count / count);
      const color = palettes[name][source.labels[original]];
      if (!color) throw new Error('Source contains an unknown vessel label');
      const variation = ((Math.imul(original + 1, 1664525) + 1013904223) >>> 0) / 4294967296;
      positions.set(source.positions.subarray(original * 3, original * 3 + 3), index * 3);
      normals.set(source.normals.subarray(original * 3, original * 3 + 3), index * 3);
      for (let axis = 0; axis < 3; axis++) colors[index * 3 + axis] = color[axis] * (.82 + .18 * variation);
      sizes[index] = name === 'cerebral' && source.labels[original] === 3 ? .55 + .35*variation : .8 + .55*variation;
    }
    return { positions, normals, colors, sizes, count, source: source.source, license: source.license };
  }
  window.VascularGeometry = Object.freeze({ createScene });
})();
