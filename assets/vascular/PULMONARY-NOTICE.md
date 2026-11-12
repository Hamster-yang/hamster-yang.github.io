# BodyParts3D pulmonary vascular geometry

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

Source: [BodyParts3D official download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), release 4.0, PART-OF Tree, published polygon reduction rate 99%. Retrieved 2026-11-10.

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/), confirmed by the [official publisher license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) updated 2025-02-27 and its [latest README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html). The downloaded OBJ comments retain the former CC BY-SA 2.1 Japan notice. The current publisher explicitly licenses this database under CC BY 4.0; the original source archive has not been modified.

This is a reference anatomical atlas built from a male volunteer's TARO MRI model and manually refined with anatomical references. It is not a patient-specific clinical segmentation, and individual vessels should not be described as directly measured from the MRI. See [Mitsuhashi et al., BodyParts3D: 3D structure database for anatomical concepts](https://doi.org/10.1093/nar/gkn613).

The NPZ combines meshes belonging to pulmonary arterial tree FMA45842 (including pulmonary trunk FMA8612) and the four pulmonary veins FMA49911, FMA49913, FMA49914 and FMA49916. Original vertices remain in their shared whole-body coordinate system, in millimetres. No branch was moved, rescaled, mirrored, or synthesized. Faces use zero-based indices; `face_labels` uses `0` for arteries and `1` for veins.

Two source meshes, FJ2041 and FJ2044, are excluded. Their respective minimum Z values are 1028.59 mm and 1014.59 mm, while all remaining pulmonary meshes begin at Z = 1123.11 mm. Their closest vertices to the remaining pulmonary mesh vertices are approximately 91.445 mm and 111.921 mm away. Their source labels are “Right anterior segmental artery”; the cause of the inconsistency is unconfirmed. These detached pieces were omitted, not repositioned.

`bodyparts3d-pulmonary.json` records the exact official source URLs, archive hash, included and excluded element IDs, original OBJ hashes, per-mesh array ranges, coordinate bounds, array types, and derived geometry hashes. The bundled compressed NPZ contains 184 source meshes, 39,220 original vertices and 67,170 triangles.

For display, apply one common translation and uniform scale to the whole scene so artery/vein relationships are preserved. Any further sampling, compression, color assignment or simplification should be documented with the generated display asset.
