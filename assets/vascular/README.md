# Anatomy point-cloud sources

The desktop displays the whole brain and the pulmonary arteries and veins from the BodyParts3D 4.0 reference atlas. Each scene retains the relative positions and proportions of its source parts.

## Source geometry

| Scene | Atlas surface | Display samples |
| --- | --- | ---: |
| Whole brain with cerebral arteries | BodyParts3D 4.0, 50 brain parts and 144 arterial parts | 80,000 |
| Pulmonary arteries and veins | BodyParts3D 4.0, 184 source meshes | 56,000 |

`bodyparts3d-brain.npz` contains 79,689 vertices and 137,062 retained triangles in the original millimetre coordinates. The source selection includes 36 parts across the two cerebral hemispheres, 2 cerebellar parts and 12 brainstem parts. The `face_labels` array uses 0 for cerebral cortex, 1 for cerebellum and 2 for brainstem.

The brain asset represents the external appearance of these structures. Starting with 217,046 triangles, the extractor identifies frontmost and near-surface faces from 126 viewing directions, with a 0.8 mm depth tolerance, then includes one ring of adjacent faces within each source mesh. The retained triangles preserve their original vertex positions and winding. [Brain manifest](bodyparts3d-brain.json) · [Brain source notice](BRAIN-NOTICE.md)

`bodyparts3d-brain-vessels.npz` contains 107,559 vertices and 175,186 triangles from 144 arterial parts. It supplies 16,000 faint, warm-colored points, labelled 3, alongside 64,000 brain surface points. The brain and the selected intracranial arteries use the same atlas coordinates and display transform, including vessels near the surface and deeper branches. [Cerebral artery manifest](bodyparts3d-brain-vessels.json)

`bodyparts3d-pulmonary.npz` contains 39,220 vertices and 67,170 triangles in original shared millimetre coordinates. The `face_labels` array uses 0 for arteries and 1 for veins. The pulmonary extraction excludes the spatially detached source parts FJ2041 and FJ2044. The manifest lists included and excluded meshes, original file hashes, bounds and array ranges. [Pulmonary manifest](bodyparts3d-pulmonary.json) · [Pulmonary source notice](PULMONARY-NOTICE.md)

## Attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

The official BodyParts3D license page, updated February 27, 2025, specifies CC BY 4.0. The source atlas was built from a volunteer MRI model and refined using anatomical references. [Official download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) · [Publisher license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [Atlas construction paper](https://doi.org/10.1093/nar/gkn613)

## Rebuild

Run the following from the repository root with Python 3 and NumPy installed.

```sh
python3 scripts/build-vascular-pointclouds.py
```

The builder samples points on the original triangles using area weights and deterministic barycentric coordinates. Each scene uses one `[x, z, -y]` axis permutation, one translation and one uniform scale. Coordinates are quantized to signed Int16 for storage and decoded as Float32 in the browser. For brain surface shading, the builder interpolates vertex normals, normalizes them to unit length and encodes them as signed Int8 values. A zero normal on arterial points selects the faint warm vessel material. Pulmonary colors follow the atlas artery and vein labels.

`pointcloud-data.js` contains the sampled coordinates and display labels. `pointcloud-build.json` records the source hash, seed, point count, coordinate transform and bounds for each scene. The browser loads the generated local data directly. [Build record](pointcloud-build.json)
