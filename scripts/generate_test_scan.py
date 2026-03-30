import numpy as np
import nibabel as nib

# Creates a fake 128x128x128 3D scan
dummy_data = np.random.rand(128, 128, 128)
img = nib.Nifti1Image(dummy_data, np.eye(4))
nib.save(img, 'test_scan.nii.gz')
print("Created test_scan.nii.gz")