# BodyParts3D brain surface

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

The source is the BodyParts3D 4.0 IS-A Tree OBJ archive, published with a 99% polygon reduction rate. The publisher updated its database license to CC BY 4.0 on 27 February 2025. The original 2013 OBJ headers retain the earlier CC BY-SA 2.1 Japan notice. [Official download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) · [Publisher’s license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

BodyParts3D is an adult anatomical reference atlas based on the TARO whole-body MRI model. Medical illustrators refined structures against anatomical references. [Mitsuhashi et al., *BodyParts3D: 3D structure database for anatomical concepts*](https://doi.org/10.1093/nar/gkn613)

## Anatomy

The selected source regions contain paired frontal, parietal, temporal, occipital and medial cortical structures. The cerebellum and brainstem complete the inferior outline. The source brainstem components represent the midbrain, cerebral peduncles, colliculi, pons and medulla. The component list excludes deep nuclei, white matter and ventricular spaces.

| Face label | Anatomical region | Source OBJ components | Source triangles | Retained triangles |
| --- | --- | ---: | ---: | ---: |
| 0 | Cerebral cortex, both hemispheres | 36 | 112,238 | 51,206 |
| 1 | Cerebellum | 2 | 47,700 | 44,740 |
| 2 | Brainstem | 12 | 57,108 | 41,116 |

## Preparation

Neighboring source components contain closed contact surfaces. A two-sided orthographic depth buffer identified the exterior from 126 directions, using 0.30 mm pixels. Triangles visible from any direction account for 41.97% of the input. A 0.8 mm depth tolerance brought this to 52.43%. A final pass included original triangles sharing a source vertex with these faces to retain neighboring sulcal walls and margins.

The external display subset contains 137,062 of 217,046 source triangles (63.15%) and 79,689 original vertices. Its bounds span approximately 140.85 × 180.01 × 165.96 mm. Each retained triangle uses the original corners in their original order. All regions share the atlas's whole-body XYZ coordinates in millimetres. The exposure filter removes faces and therefore produces an open display surface around the selected structures.

All 50 source components had positive signed volume. Every original face cross product agreed in direction with its supplied OBJ corner normals, supporting outward lighting from the retained winding. The source positions and corner order of every retained triangle were independently checked against the ZIP.

The [manifest](bodyparts3d-brain.json) records the source URL, archive and OBJ hashes, FMA and representation IDs, per-component face counts, original and retained bounds, exposure-filter settings, winding checks and output array hashes. The [geometry file](bodyparts3d-brain.npz) stores `vertices`, `faces` and `face_labels`.

## Cerebral arteries

The [arterial surface](bodyparts3d-brain-vessels.npz) uses 144 original components from the same BodyParts3D archive and whole-body coordinates as the surrounding brain. It includes anterior, middle and posterior cerebral branches, communicating and cerebellar arteries, the basilar artery, and sections of the internal carotid and vertebral arteries. The source contains both deep vessels and vessels following the cerebral surface. The display uses the brain's shared translation and uniform scale for both layers.

The arterial subset retains triangles whose three original vertices are at or above Z = 1490 mm. The internal carotid parts FJ1682 and FJ1682M use Z = 1510 mm to limit their inferior extensions away from the brain. The source's two anterior spinal arteries are omitted, and FJ1672 supplies the basilar artery in place of the overlapping alternate representation FJ1844. All retained coordinates and triangle corners come directly from the original OBJ files.

The output has 107,559 vertices and 175,186 triangles with face label `3`. Of these vertices, 89,801 lie inside the convex hull of the brain display surface. Each of the remaining 17,758 is within 7.34 mm of a retained brain vertex, with a median distance of 2.38 mm. The convex hull is an approximate check of the overall silhouette. The [arterial manifest](bodyparts3d-brain-vessels.json) records the source IDs, crop rules, position checks, coordinate bounds and geometry hashes.
