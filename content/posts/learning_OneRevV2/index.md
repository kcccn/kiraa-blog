---
title: "OneRev V2 学习笔记" 
date:  2026-02-06
draft: false
tags:   [LLM, note]
math:  true
---

# OneRec V2

## Kuaishou OneRec Family

| **版本**         | **论文/报告标题**                                            | **发布时间 (arXiv)** | **核心架构**          | **解决的关键痛点**                                       |
| ---------------- | ------------------------------------------------------------ | -------------------- | --------------------- | -------------------------------------------------------- |
| **OneRec V1**    | *[OneRec Technical Report](https://arxiv.org/abs/2506.13695)* | 2025. 06             | **Encoder-Decoder**   | **范式验证**：证明了“推荐”可以重构为“生成”任务。         |
| **OneRec V2**    | *[OneRec-V2 Technical Report](https://arxiv.org/abs/2508.20900)* | 2025. 08             | **Lazy Decoder-Only** | **计算效率**：解决 V1 编码太慢的问题，实现工业级低延迟。 |
| **OneRec-Think** | *[OneRec-Think: In-Text Reasoning for Generative Recommendation](https://arxiv.org/abs/2510.11639)* | 2025. 10             | **Think-Ahead (CoT)** | **深度理解**：让模型在推荐前先“思考”理由，增强可解释性。 |
| **OpenOneRec**   | *[OpenOneRec Technical Report](https://arxiv.org/abs/2512.24762)* | 2025. 12             | **Qwen-based**        | **开源与通用**：打破数据孤岛，发布基础模型。             |

 分为两组：

- **OneRec V1/V2: ** 主攻端到端，低延时，在线推荐，V2 是对 V1 的改进。

  > OpenRec V2 改进了 V1 的 encoder-decoder 结构，总计算量（应该指推理的 FLOPS）减少 94%，训练资源减少 90%。模型参数可以从 0.5B 扩展到 8B，同时符合 scaling law。

- **OneRec-Think / OpenOneRec ** 主攻逻辑推理、语义理解，让模型不仅知道推荐什么，还知道为什么推荐。前者在业务上有实际的部署和验证；后者则完全基于 Qwen，倾向于在学术界给出一个通用的范式。

**以下主要介绍 OneRec V2 的模型结构和推理过程。**

## Tokenizer

> 这一步和 OneRec V1 相同。目的是给每个 video 赋予一个 token，用低维特征表示高维稀疏特征。 

#### 相似物品数据集构建

我们希望构造一个数据集 $D$ ，里面包含若干个物品对，表示这些物品之间是相似的。

考虑用现有模型或方法从两方面提取：

- **User2Item:** 当用户点击了 $A$，并且是正向的，那么从用户最近点击的 50 个正向物品中，选一个与 $A$ 最相似的物品 $B$，构造相似物品对 $(A, B)$ 加入 $D$  中。

- **Item2Item:** 使用现有方法（如 Swing retrieval model），可以直接提取出若干相似物品对加入  $D$ 。

#### 对比学习

对于每个 video，提取以下特征：

- 视频封面 + 5 帧图像
- 标题 + Tag + 图像转文字 (OCR) + 语音转文字 (ASR)

将特征输入 miniCPM-V-8B ，得到 1280 个 512 维的特征向量：
$$
\mathbf{M} \in \mathbb{R} ^ {N_M \times d_t} \\
N_M = 1280, d_t = 512
$$
然后使用交叉注意力机制压缩信息。具体地：
$$
\mathbf{Q}^{(i+1)} = \text{CrossAttn}(\mathbf{Q}^{(i)}, \mathbf{M}, \mathbf{M})\\
\mathbf{Q}^{(i+1)} = \text{FFN}(\text{RMSNorm}(\mathbf{Q}^{(i+1)})),\quad \text{for}\ i = 1 \to N_c
$$
其中 $\mathbf{Q} \in \mathbf{R}^{N_{M'}\times d_t}$ 。$\mathbf{M}$ 最后压缩成了 $N_c$ 个 $d_t$ 维的特征向量：
$$
\mathbf{M'} = \mathbf{Q}^{(Nc+1)} \in \mathbb{R} ^ {N_c \times d_t}
$$
$\text{CrossAttn}(\mathbf{Q}, \mathbf{K}, \mathbf{V})$ 表示对应位置上的矩阵做 Attention 计算，只不过三个矩阵不一定来自同一个序列，所以称为 Cross 。

注意到前一层计算的结果直接作为下一层的 $\mathbf{Q}$ ，所以只需确定 $\mathbf{Q}^{(1)}$ 和各个 $\text{FFN}$ 的参数即可。

论文中取 $N_{M'} = 4, N_c =4$ ，表示最后得到 $4$ 个特征向量，模型包含 $4$ 个 Transformer 层。

最后对提取出来的向量计算对比损失。同时还加了一个 LLaMA3 对特征向量解码，与 video 标题做对比，也算入损失中，让特征保持语义，推理的时候无需 LLaMA3 这一步。

#### RQ-Code

对提取出来的特征，每次进行 K-means 聚类，然后特征减去聚类中心（共 8192 个），依次迭代，共 3 层。将聚类中心编码作为码表，得到 8192x8192x8192 的三位编号，作为 video 的语义 token ，实现了用低维表示高维稀疏特征。

## Multi-Scale Feature Engineering

> 这一步和 OneRec V1 相同。

### User Static Pathway

用户个人数据特征：uid，年龄，性别等统一到 64 维特征向量，拼接后塞进 MLP 。
$$
\begin{aligned}
\mathbf{f}_u &= [\mathbf{e}_{\text{uid}}; \mathbf{e}_{\text{gender}}; \mathbf{e}_{\text{age}}; \cdots]\\
\mathbf{h}_u &= \text{Dense}(\text{LeakyReLU}(\text{Dense}(\mathbf{f}_u)))\\
\end{aligned}
$$
其中，
$$
\mathbf{e}_{\text{uid}}, \mathbf{e}_{\text{gender}}, \mathbf{e}_{\text{age}} \in \mathbb{R}^{64}\\\mathbf{h}_u \in \mathbb{R}^{1 \times d_{\text{model}}}
$$

### Short-term Pathway

提取用户最近的 $L_s = 20$ 条交互数据，包含视频编号、作者、tag、交互行为等等，总之是拼在一起然后塞进 MLP，得到 $L_s$ 个 $d_{\text{mode}l}$ 维的特征 $\mathbf{h}_s \in \mathbb{R}^{L_s \times d_{\text{model}}}$ ，这里不再赘述。

### Positive-feedback PathWay

提取用户最近的 $L_p = 256$ 条 high-engagement 交互数据，类似的方式得到 $\mathbf{h}_p \in \mathbb{R}^{L_p \times d_{\text{model}}}$ 。

### Lifelong Pathway

这个有点复杂，总之得到了 $\mathbf{h}_l \in \mathbb{R}^{N_q \times d_{\text{model}}}$，其中 $N_q = 128$ 。

### 总结

对于每个用户，从四个方面得到了 $1 + L_s + L_p + N_q$ 个特征向量。

## Context Processor

> 这一步与 V1 不同，V1 使用一个 Encoder 来处理特征向量，这里换成了更轻量的 Context Processor，优化了繁琐的 Encode 计算。



## Lazy Decoder Block

> 适配

首先，

