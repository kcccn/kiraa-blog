---
title: "训练日志" 
date:  2026-01-31
draft: true
tags:   [VLM, CV]
math:  true
---

# 0 图文对齐训练

## 0.0 数据对齐

### 数据格式

论文中在这一阶段选择的数据集是 M3D-Cap 。

链接：[3D多模态医疗数据集-图文对 · 数据集](https://www.modelscope.cn/datasets/GoodBaiBai88/M3D-Cap)

```
M3D_Cap/
    ct_case/
        000006/
            Axial_non_contrast/
                0.jpeg
                1.jpeg
                ......
            text.txt
        ......
    ct_quizze/
        000007/
            Axial_non_contrast/
                0.png
                1.png
                ......
            text.txt
        ......
    ......
```

有点抽象的是里面的 3D 切片使用多个 jpeg 或 png 的 2D 切片组合起来的。

每个病例包含一个 **多个** 3D 切片和对应的文本描述，case 和 quizze 的区别是后者用于医学考试，质量更高。

文本示例：

```
Liver shows the following: cirrhotic changes with surface nodularity and hypertrophied caudate lobe multiple bi-lobar patches of low attenuation (<10 HU attenuation in the non contrast phase and <25 HU in the portal venous phase), suggestive of hepatic steatosis right hepatic lobe segment VI and left hepatic lobe segment IVa patches of contrast enhancement showing contrast enhancement at the early enhancement at the arterial and portal phases with no contrast wash out at the delayed phase, likely inflammatory in nature signs of fibrosis evident by surface nodularity, widened preportal and gallbladder fossae Portal hypertension and splenomegaly.Mild abdominal and pelvic ascites.
```

### 数据流

#### 配置数据列表文件

示例：

```json
{
    "train": [
        {
            "image": "./data/M3D_Cap/ct_case/000001/Axial_non_contrast.nii.gz",
            "text": "./data/M3D_Cap/ct_case/000001/report.txt"
        },
        {
            "image": "./data/M3D_Cap/ct_case/000002/Axial_non_contrast.nii.gz",
            "text": "./data/M3D_Cap/ct_case/000002/report.txt"
        }
    ],
    "test": [
        {
            "image": "./data/M3D_Cap/ct_case/000003/Axial_non_contrast.nii.gz",
            "text": "./data/M3D_Cap/ct_case/000003/report.txt"
        }
    ],
    "val": [
        {
            "image": "./data/M3D_Cap/ct_case/000004/Axial_non_contrast.nii.gz",
            "text": "./data/M3D_Cap/ct_case/000004/report.txt"
        }
    ]
}
```

#### 数据预处理

图像数据增强及转换：

```python
train_transform = mtf.Compose(              # 数据增强
    [
        mtf.RandRotate90(prob=0.5, spatial_axes=(1, 2)),
        mtf.RandFlip(prob=0.10, spatial_axis=0),
        mtf.RandFlip(prob=0.10, spatial_axis=1),
        mtf.RandFlip(prob=0.10, spatial_axis=2),
        mtf.RandScaleIntensity(factors=0.1, prob=0.5),
        mtf.RandShiftIntensity(offsets=0.1, prob=0.5),

        mtf.ToTensor(dtype=torch.float),     # 数据类型转换
    ]
)

val_transform = mtf.Compose(                 # 验证/测试 数据预处理
        [
            mtf.ToTensor(dtype=torch.float), # 数据类型转换
        ]
    )
set_track_meta(False)
```

文本数据截断：设置的 ClinicalBERT 的 max token 为 512 ，对于超出长度的文本，先以 '.' 为标志划分句子，然后在不超过长度上限的前提下随机挑选句子，组成新的长度限制内的文本描述。

> 原代码中的数据管道没有 resize 的操作，也就是默认所有输入的图片都是统一尺寸 (W, H, D) = (256, 256, 128) 。因此，我在 CLIPDataset 类中新增了图片缩放的预处理，缩放结合了扫描的空间分辨率，确保处理后的扫描与物理空间相符。

#### 返回格式

如下:

```python
ret = {
    'image': image,
    'text': text,
    'input_id': input_id,
    'attention_mask': attention_mask,
    'question_type': "Image_text_retrieval",
}
```

### OpenMind 数据适配

OpenMind 包含脑部 MRI 图像 3D 扫描，以及基本的脑部掩码等，文本数据只有简单的元数据（如性别、年龄、种族等）。为了进行图文训练，使用 Qwen3-VL-8B-Instruct 生成伪文本描述。

利用 Qwen3-VL 的视觉能力，我们输入 3D 切片的 3 个正交中心切面，以及相应的指令。示例如下：

![image-20260201022042278](C:\Users\86189\AppData\Roaming\Typora\typora-user-images\image-20260201022042278.png)

输入 prompt:

```
Role: System
You are an expert Neuroradiologist. Your task is to provide a conservative, high-level radiological impression (summary) for the provided brain MRI case. Rules:
1. VOLUMETRIC SYNTHESIS: Although the input is a montage of representative orthogonal slices, interpret them as a complete 3D MRI volume.
2. INTEGRATE METADATA: Start the report by explicitly stating the scan modality and patient demographics.
3. PRIORITIZE MACRO-STRUCTURES: Assess symmetry, midline, and ventricular system.
4. BE CONSERVATIVE: Do not report minute findings unless they are undeniably abnormal.
5. TERMINOLOGY: Use 'Unremarkable' or 'Within normal limits’.
6. OUTPUT FORMAT: A single, flowing paragraph. No bullet points.

Role: User
[IMAGE_DATA_PLACEHOLDER] Analyze these representative orthogonal slices from a 3D volumetric MRI scan. The views are presented as: Axial (left), Coronal (middle), Sagittal (right).
Case Metadata: Subject is a 26-year-old female. Modality: T1-weighted MRI. [Note: Image quality is fair (Score: 2.3/5).] Note: Images are skull-stripped (background removed). Clinical Indication: Routine follow-up for headache.
Please generate the Impressions.

Role: Assistant
Findings:

```

生成文本:

```
This 3D volumetric T1-weighted MRI of the brain in a 26-year-old female, despite suboptimal image quality (score 2.3/5), demonstrates symmetric cerebral hemispheres with preserved sulcal and gyral patterns across axial, coronal, and sagittal planes. The ventricular system appears within normal limits in size and configuration, with no evidence of midline shift or significant structural abnormality. No focal lesions, mass effect, or abnormal signal intensity are identified. The overall impression is unremarkable.
```

### RadImageNet-alignment 数据适配

数据示例：

<img src="C:\Users\86189\AppData\Roaming\Typora\typora-user-images\image-20260201190647263.png" alt="image-20260201190647263" style="zoom:50%;" />

```
Image size: (224, 224), mode: RGB
Metadata: {'content_type': 'description', 'correct_text': None, 'is_abnormal': True, 'location': 'ankle foot', 'modality': 'mri', 'pathology': 'Plantar_plate_tear', 'question_id': 'description'}
[{'from': 'human', 'value': '<image>\nDescribe the medical imaging features and anatomical details.'}
 {'from': 'template', 'value': 'magnetic resonance imaging of the ankle foot foot with plantar plate tear present'}]
```

包含 metadata，以及简单的描述。

原数据集共 750k 病例，其中 MRI 600k 例，覆盖不同部位与不同疾病，数据总览如下：

```
=== Modality Counts Before Cleaning ===
Modalities Total: {'ct': 228902, 'mri': 604775}
=== Modality Counts After Cleaning ===
Modalities Total After: {'mri': 604775}

=== Overall Metadata Statistics ===
Field: content_type
  description: 604775

Field: correct_text
  None: 604775

Field: is_abnormal
  True: 482222
  False: 122553

Field: location
  ankle foot: 162517
  brain: 40001
  hip: 46477
  knee: 161744
  abdomen: 82563
  shoulder: 47206
  spine: 64267

Field: modality
  mri: 604775

Field: pathology
  Plantar_plate_tear: 599
  achilles_pathology_: 8277
  atfl_pathology: 10819
  bone_inflammation: 36099
  cfl_pathology: 3851
  chondral_abnormality: 85073
  coalition: 58
  deltoid_pathology: 2478
  extensor_pathology_: 618
  fat_containing_tumor: 244
  flexor_pathology_: 3259
  hematoma: 747
  intra: 5954
  lisfranc_pathology: 47
  normal: 122553
  osseous_disruption: 11826
  osseous_neoplasm: 1317
  peroneal_pathology: 6589
  plantar_fascia_pathology: 5752
  post_op: 5659
  soft_tissue_edema: 15691
  soft_tissue_fluid: 37215
  soft_tissue_mass: 8472
  spring_ligament_injury: 97
  syndesmosis_pathology: 343
  acute_infarct: 448
  arteriovenous_anomaly: 241
  chronic_infarct: 2040
  edema: 111
  extra: 1113
  focal_flair_hyper: 672
  pituatary_lesion: 69
  white_matter_changes: 9185
  abductor_pathology_: 765
  capsular_pathology: 109
  chondral_pathology: 7260
  hamstring_pathology: 212
  labral_pathology: 36163
  marrow_inflammation: 4295
  osseous_lesion: 2364
  acl_pathology: 9059
  fcl_pathology: 408
  fracture: 1402
  mcl_pathology: 7123
  meniscal_abnormality: 40498
  muscle_strain: 464
  patella_pathology: 1266
  pcl_pathology: 667
  post_operative_acl: 77
  quad_pathology: 450
  soft_tissue_fluid_collection: 23060
  adrenal_pathology: 581
  arterial_pathology: 76
  ascites: 699
  bil_dil: 216
  bladder_pathology: 130
  bowel_abnormality: 151
  bowel_inflammation: 239
  bowel_mass: 93
  degenerative_changes: 165
  dilated_urinary_tract: 55
  enlarged_organ: 183
  gallbladder_pathology: 434
  intraperitoneal_mass: 804
  liver_disease_: 971
  liver_lesion: 2987
  marrow_abn: 649
  ovarian_pathology: 1673
  pancreatic_lesion: 996
  prostate_lesion: 65
  renal_lesion: 1834
  soft_tissue_collection: 161
  splenic_lesion: 214
  uterine_pathology: 3219
  acj_oa: 2392
  biceps_pathology: 1450
  ca++_tendinosis: 69
  ghj_oa: 2618
  infraspinatus_pathology: 80
  subscapularis_pathology: 128
  supraspinatus_pathology: 4680
  cord_pathology_: 642
  cystic_lesions: 1221
  disc_pathology: 29370
  dural_epidural_abn: 7410
  facet_arthropathy: 325
  foraminal_pathlogy: 10735
  osseous_abn: 2095
  scoliosis: 1807

Field: question_id
  description: 604775
```

对于 2D 图片，将其复制 32 层置于中心，其余全黑，**在平均池化的时候乘上缩放因子 $128 / 32 = 4$** ，避免信号过弱。32 层是因为模型最大核大小为 7 ，深度下采样 16 倍，选择 16 或 32 可以较好保持信息。

对于文本，采用 metadata 和原文本结合的方式构造。

示例：

![image-20260201191959059](C:\Users\86189\AppData\Roaming\Typora\typora-user-images\image-20260201191959059.png)

```
Abnormal MRI scan of the ankle foot. magnetic resonance imaging of the ankle foot foot with plantar plate tear present. Diagnosis: Plantar plate tear.
```

## 训练

### 训练配置

```sh
#!/bin/bash
deepspeed src/train/train_clip.py \
    --deepspeed ./scripts/zero2.json \
    --language_model_name_or_path medicalai/ClinicalBERT \
    --wb_name DCFormer_SigLIP \
    --vision_encoder "dcformer" \
    --loss_type "sigmoid" \
    --data_root ./data \
    --cap_data_path ./data/datalist.json \
    --max_length 512 \
    --bf16 True \
    --output_dir ./output/DCFormer_SigLIP \
    --num_train_epochs 100 \
    --per_device_train_batch_size 42 \
    --per_device_eval_batch_size 4 \
    --gradient_accumulation_steps 1 \
    --eval_strategy "no"\
    --eval_accumulation_steps 1 \
    --eval_steps 0.04 \
    --save_strategy "steps" \
    --save_steps 1000 \
    --save_total_limit 1 \
    --learning_rate 1e-4 \
    --weight_decay 0.1 \
    --warmup_ratio 0.03 \
    --lr_scheduler_type "cosine" \
    --logging_steps 0.001 \
    --gradient_checkpointing False \
    --dataloader_pin_memory False \
    --dataloader_num_workers 12
```

唯一更改的地方: per_device_train_batch_size: 64 -> 42

### 训练进度

| 数据集                | 训练(cases) | 图像类型 | 文本   |
| --------------------- | ----------- | -------- | ------ |
| OpenMind              | 10000 (10%) | 3D       | 伪文本 |
| RadImageNet-alignment | 12000 (2%)  | 2D       | 原生   |
|                       |             |          |        |

训练监控: [MRI-3D-VLM Table – Weights & Biases](https://wandb.ai/MRI-1145/MRI-3D-VLM/table?nw=nwuserkiraaa)
