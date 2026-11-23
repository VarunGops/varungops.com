# Data preparation for the varungops.com home stage

The brain, its fibre tracts and the heart on the home page are built from open anatomical data. Nothing is drawn by hand. The raw downloads are large and are not kept in the repository; these scripts rebuild the small files the page loads.

## Sources

| What | File to download | From | Licence |
|---|---|---|---|
| Brain surface | `mni_icbm152_nlin_sym_09c_nifti.zip` (55 MB) | https://www.bic.mni.mcgill.ca/~vfonov/icbm/2009/ | McGill BIC: free to use, copy, modify and distribute with the copyright notice kept |
| Lobe labels | `mni_icbm152_nlin_sym_09c_CerebrA_nifti.zip` (0.3 MB) | https://packages.bic.mni.mcgill.ca/mni-models/icbm152/ | CC0 (Manera et al., Scientific Data 2020) |
| Fibre tracts | `hcp1065_avg_tracts_tt.zip` (144 MB) | https://github.com/data-others/atlas/releases/tag/hcp1065 | CC BY-SA 4.0 (Yeh, Nat Commun 2022), plus Human Connectome Project acknowledgement |
| Heart | `partof_BP3D_4.0_obj_99.zip` (62 MB) and `partof_element_parts.txt` | https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ | BodyParts3D. File headers say CC BY-SA 2.1 Japan, the licence page says CC BY 4.0. Treated here as share-alike. |

## Build

Needs Python 3 with `numpy`, `scipy`, `nibabel` and `scikit-image`.

```bash
python3 prep_brain.py  <mni_zip> <cerebra_zip> ../data 150000
python3 prep_tracts.py <tt_zip> ../data 16000 32
python3 prep_heart.py  <bp3d_zip> <partof_element_parts.txt> ../data
python3 ../build.py
```

## What each script produces

- `brain.bin`, `brain.json`: the pial surface of the MNI ICBM 2009c template (cerebrum, cerebellum, brainstem) as about 75,000 vertices. Each vertex carries its lobe, its sulcal depth and its height above a smoothed copy of the surface, which is how the page lights every gyrus and leaves every sulcus dark.
- `tracts.bin`, `tracts.json`: 16,067 streamlines thinned from the HCP-1065 atlas, 32 points each, in shuffled order so a small screen can draw the first part of the file. Projection pathways get a larger share because they carry the impulse out from the centre. Those that reach the medulla are flagged, and the page continues them as the spinal cord.
- `heart.bin`, `heart.json`: atria, great vessels, coronary arteries and cardiac veins as given by BodyParts3D, plus the outer ventricular surface.

## One reconstruction to know about

BodyParts3D 4.0 has no outer ventricular wall, only the two ventricular cavities. `prep_heart.py` rebuilds that surface by thickening each cavity. The thickness is measured from the model, as the distance at which its own coronary arteries lie from each cavity: about 7 mm on the left and 2 mm on the right. Everything else in the heart is the source mesh unchanged.

## Credits the site must show

- MNI ICBM 152 2009c template, Copyright (C) 1993-2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University.
- Tracts adapted from the HCP-1065 tractography atlas (Yeh FC, Nat Commun 13, 4933, 2022), CC BY-SA 4.0. Data were provided by the Human Connectome Project, WU-Minn Consortium.
- Heart adapted from BodyParts3D, (c) The Database Center for Life Science.

The adapted tract and heart files are offered under the same share-alike terms.
