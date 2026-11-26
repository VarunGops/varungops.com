# Data preparation for the varungops.com home stage

The brain, its fibre tracts and the heart on the home page are built from open anatomical data. Nothing is drawn by hand. The raw downloads are large and are not kept in the repository; these scripts rebuild the small files the page loads.

## Sources

| What | File to download | From | Licence |
|---|---|---|---|
| Brain surface | `mni_icbm152_nlin_sym_09c_nifti.zip` (55 MB) | https://www.bic.mni.mcgill.ca/~vfonov/icbm/2009/ | McGill BIC: free to use, copy, modify and distribute with the copyright notice kept |
| Lobe labels | `mni_icbm152_nlin_sym_09c_CerebrA_nifti.zip` (0.3 MB) | https://packages.bic.mni.mcgill.ca/mni-models/icbm152/ | CC0 (Manera et al., Scientific Data 2020) |
| Fibre tracts | `hcp1065_avg_tracts_tt.zip` (144 MB) | https://github.com/data-others/atlas/releases/tag/hcp1065 | CC BY-SA 4.0 (Yeh, Nat Commun 2022), plus Human Connectome Project acknowledgement |
| Heart | `partof_BP3D_4.0_obj_99.zip` (62 MB) and `partof_element_parts.txt` | https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ | BodyParts3D. File headers say CC BY-SA 2.1 Japan, the licence page says CC BY 4.0. Treated here as share-alike. |
| Eyes (Now page) | `3d-vh-m-eye-l.glb` (27 MB) and `3d-vh-m-eye-r.glb` (21 MB) | https://3d.nih.gov/entries/3DPX-020998 and https://3d.nih.gov/entries/3DPX-020999 (Human Reference Atlas, from the Visible Human Male) | CC BY 4.0 |
| Lungs (Life page) | `3d-vh-f-lung.glb` (23 MB) | https://3d.nih.gov/entries/3DPX-021008 (download: https://3d.nih.gov/entries/download/21008/2). The page says male; every part in the file is the Visible Human Female's (`VH_F_…`). | CC BY 4.0 |
| Neuron and its neighbours (Research page) | `104_proofread_neurons_swc.zip` (unzipped into `raw/104_proofread_neurons_swc/`) and `raw/h01_cells.json` made by `python3 prep/fetch_h01_cells.py raw/h01_cells.json` (needs `pip3 install tensorstore`) | https://storage.googleapis.com/h01-release/data/20210601/proofread_104/skeletons/104_proofread_neurons_swc.zip and gs://h01-release/data/20210601/cell_bodies (H01 release, Shapson-Coe et al., Science 2024) | CC BY 4.0 |
| Hands (Clinical Experience page) | `lincoln_hands-150k-4096.glb` (14 MB) | https://3d.si.edu/object/3d/abraham-lincoln:d8c642d6-4ebc-11ea-b77f-2e728ce88125 (National Portrait Gallery, S/NPG.71.6; download from the 3D viewer) | CC0 |

## Build

Needs Python 3 with `numpy`, `scipy`, `nibabel` and `scikit-image`.

```bash
python3 prep_brain.py  <mni_zip> <cerebra_zip> ../data 150000
python3 prep_tracts.py <tt_zip> ../data 16000 32
python3 prep_heart.py  <bp3d_zip> <partof_element_parts.txt> ../data
python3 ../build.py
```

## What each script produces

- `hands.bin`, `hands.json` (and `-lite`): `prep_hands.py raw/lincoln_hands-150k-4096.glb public/data`. The two casts, welded and simplified, each turned for the drawing (the right hand, a fist round a cut broom handle, reaches down back-first; the left reaches up palm-first) and centred on its wrist. Seven string anchors per hand are real vertices on the visible side of the fingers.

- `lungs.bin`, `lungs.json` (and `-lite`): `prep_lungs.py raw/3d-vh-f-lung.glb public/data`. Both lungs in millimetres in the Visible Human frame, centred on their bounding box: the bronchopulmonary segments and hilum as the surface, the lobar and segmental bronchi inside. The bronchial cartilage rings are left out. `outline` holds the lungs' front-view silhouette, one loop per lung.
- `neuron.bin`, `neuron.json` (and `-lite`): `prep_neuron.py raw/104_proofread_neurons_swc raw/h01_cells.json public/data`. H01 cell 3955003482 in micrometres about its soma, turned about the depth axis so the apical dendrite points up, as segments of about 2 um (4 um lite) with their distance along the cell; then the real cell-body centres within 900 x 900 x 200 um of it, turned the same way, its own body left out.
- `eyes.bin`, `eyes.json` (and `-lite`): `prep_eyes.py raw/3d-vh-m-eye-l.glb raw/3d-vh-m-eye-r.glb public/data`. Both eyes in millimetres in the Visible Human frame (+x the subject's left, +y up, +z forward), centred between the globes: sclera, cornea, iris, pupil, lens, ciliary body, retina and choroid, welded and simplified. The models have no extraocular muscles or optic nerve, and none are added. Fluids, conjunctiva and the drainage angle are left out.

- `brain.bin`, `brain.json`: the pial surface of the MNI ICBM 2009c template (cerebrum, cerebellum, brainstem) as about 75,000 vertices. Each vertex carries its lobe, its sulcal depth and its height above a smoothed copy of the surface, which is how the page lights every gyrus and leaves every sulcus dark.
- `tracts.bin`, `tracts.json`: 16,067 streamlines thinned from the HCP-1065 atlas, 32 points each, in shuffled order so a small screen can draw the first part of the file. Projection pathways get a larger share because they carry the impulse out from the centre. Those that reach the medulla are flagged, and the page continues them as the spinal cord.
- `heart.bin`, `heart.json`: atria, great vessels, coronary arteries and cardiac veins as given by BodyParts3D, plus the outer ventricular surface.

## One reconstruction to know about

BodyParts3D 4.0 has no outer ventricular wall, only the two ventricular cavities. `prep_heart.py` rebuilds that surface by thickening each cavity. The thickness is measured from the model, as the distance at which its own coronary arteries lie from each cavity: about 7 mm on the left and 2 mm on the right. Everything else in the heart is the source mesh unchanged.

## Credits the site must show

- MNI ICBM 152 2009c template, Copyright (C) 1993-2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University.
- Tracts adapted from the HCP-1065 tractography atlas (Yeh FC, Nat Commun 13, 4933, 2022), CC BY-SA 4.0. Data were provided by the Human Connectome Project, WU-Minn Consortium.
- Heart adapted from BodyParts3D, (c) The Database Center for Life Science.
- Eyes adapted from the Human Reference Atlas 3D reference organs (NIH 3D 3DPX-020998 and 3DPX-020999), created from the Visible Human Male, National Library of Medicine. CC BY 4.0.
- Lungs adapted from the Human Reference Atlas 3D reference organs (NIH 3D 3DPX-021008), created from the Visible Human Female, National Library of Medicine. CC BY 4.0.
- Neuron and cell positions from the H01 dataset (Shapson-Coe et al., Science 2024; Lichtman Lab, Harvard, and Google), CC BY 4.0.
- Hands adapted from 3D scans of plaster casts of Abraham Lincoln's hands, after Leonard Wells Volk, 1860. National Portrait Gallery, Smithsonian Institution, CC0.

The adapted tract and heart files are offered under the same share-alike terms.
