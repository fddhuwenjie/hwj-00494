<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">导入导出</h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="导出数据" name="export">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="page-container" style="margin-bottom: 20px;">
              <h3 class="detail-section-title">
                <el-icon><Download /></el-icon>
                数据导出
              </h3>
              <p style="color: #909399; margin-bottom: 20px;">
                将家族族谱数据导出为不同格式，方便分享和打印
              </p>
              
              <el-space direction="vertical" style="width: 100%;" :size="15">
                <el-card shadow="hover">
                  <template #header>
                    <div class="card-header">
                      <span><el-icon><Document /></el-icon> GEDCOM 格式</span>
                      <el-tag type="info" size="small">标准家谱格式</el-tag>
                    </div>
                  </template>
                  <p style="color: #606266; margin-bottom: 15px;">
                    GEDCOM 是家谱数据交换的标准格式，可以导入到其他家谱软件中。
                  </p>
                  <el-button type="primary" @click="exportGedcom" :loading="exporting.gedcom">
                    <el-icon><Download /></el-icon>
                    导出 GEDCOM
                  </el-button>
                </el-card>

                <el-card shadow="hover">
                  <template #header>
                    <div class="card-header">
                      <span><el-icon><Picture /></el-icon> PNG 图片</span>
                      <el-tag type="success" size="small">高清图片</el-tag>
                    </div>
                  </template>
                  <p style="color: #606266; margin-bottom: 15px;">
                    将族谱树导出为 PNG 高清图片，适合分享到社交媒体。
                  </p>
                  <el-button type="success" @click="exportPng" :loading="exporting.png">
                    <el-icon><Download /></el-icon>
                    导出 PNG
                  </el-button>
                </el-card>

                <el-card shadow="hover">
                  <template #header>
                    <div class="card-header">
                      <span><el-icon><Printer /></el-icon> PDF 文档</span>
                      <el-tag type="warning" size="small">A3横向</el-tag>
                    </div>
                  </template>
                  <p style="color: #606266; margin-bottom: 15px;">
                    导出为 A3 横向 PDF 文档，包含完整的人员信息和家族关系，适合打印存档。
                  </p>
                  <el-button type="warning" @click="exportPdf" :loading="exporting.pdf">
                    <el-icon><Download /></el-icon>
                    导出 PDF
                  </el-button>
                </el-card>
              </el-space>
            </div>
          </el-col>

          <el-col :span="12">
            <div class="page-container" style="margin-bottom: 20px;">
              <h3 class="detail-section-title">
                <el-icon><Upload /></el-icon>
                数据导入
              </h3>
              <p style="color: #909399; margin-bottom: 20px;">
                从 GEDCOM 格式文件导入家族族谱数据
              </p>
              
              <el-card shadow="hover">
                <template #header>
                  <div class="card-header">
                    <span><el-icon><UploadFilled /></el-icon> 导入 GEDCOM 文件</span>
                  </div>
                </template>
                <p style="color: #606266; margin-bottom: 15px;">
                  选择一个 .ged 或 .gedcom 格式的文件进行导入。导入的数据将追加到当前家谱中。
                </p>
                
                <el-upload
                  ref="uploadRef"
                  :auto-upload="false"
                  :on-change="handleFileChange"
                  :before-remove="handleBeforeRemove"
                  accept=".ged,.gedcom,text/plain"
                  :limit="1"
                  drag
                  style="margin-bottom: 15px;"
                >
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                  <div class="el-upload__text">
                    将文件拖到此处，或<em>点击上传</em>
                  </div>
                  <template #tip>
                    <div class="el-upload__tip">
                      仅支持 .ged 或 .gedcom 格式文件
                    </div>
                  </template>
                </el-upload>

                <div v-if="importResult" :class="importResult.success ? 'import-success' : 'import-error'">
                  <p><strong>{{ importResult.success ? '导入成功！' : '导入失败！' }}</strong></p>
                  <p v-if="importResult.message">{{ importResult.message }}</p>
                  <p v-if="importResult.persons_imported">
                    导入人数: {{ importResult.persons_imported }}
                  </p>
                  <p v-if="importResult.families_imported">
                    导入家庭数: {{ importResult.families_imported }}
                  </p>
                </div>

                <el-button 
                  type="primary" 
                  @click="importGedcom" 
                  :loading="importing"
                  :disabled="!selectedFile"
                  style="width: 100%;"
                >
                  <el-icon><Upload /></el-icon>
                  开始导入
                </el-button>
              </el-card>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="分享链接" name="share">
        <div class="page-container">
          <h3 class="detail-section-title">
            <el-icon><Share /></el-icon>
            生成分享链接
          </h3>
          <p style="color: #909399; margin-bottom: 20px;">
            生成只读模式的分享链接，让其他人可以查看您的家谱但不能修改
          </p>

          <el-card shadow="hover" style="margin-bottom: 20px;">
            <template #header>
              <div class="card-header">
                <span><el-icon><Key /></el-icon> 生成新的分享链接</span>
              </div>
            </template>
            
            <el-form :model="shareForm" label-width="100px">
              <el-form-item label="链接名称">
                <el-input v-model="shareForm.name" placeholder="给这个分享链接起个名字" />
              </el-form-item>
              <el-form-item label="有效期">
                <el-select v-model="shareForm.expires_days">
                  <el-option label="1天" :value="1" />
                  <el-option label="7天" :value="7" />
                  <el-option label="30天" :value="30" />
                  <el-option label="永久有效" :value="null" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="createShareLink" :loading="creatingShare">
                  <el-icon><Link /></el-icon>
                  生成分享链接
                </el-button>
              </el-form-item>
            </el-form>

            <div v-if="generatedLink" class="generated-link">
              <el-alert type="success" show-icon style="margin-bottom: 15px;">
                <template #title>分享链接已生成！</template>
                <p>请复制以下链接分享给他人：</p>
                <el-input 
                  v-model="generatedLink" 
                  readonly
                  style="margin: 10px 0;"
                >
                  <template #append>
                    <el-button @click="copyLink">
                      <el-icon><CopyDocument /></el-icon>
                      复制
                    </el-button>
                  </template>
                </el-input>
              </el-alert>
            </div>
          </el-card>

          <div class="page-container">
            <h3 class="detail-section-title">
              <el-icon><List /></el-icon>
              已生成的分享链接
            </h3>
            
            <el-table :data="shareLinks" v-loading="loadingShares">
              <el-table-column prop="name" label="名称" />
              <el-table-column prop="token" label="Token" width="200">
                <template #default="{ row }">
                  <el-tag type="info">{{ row.token.slice(0, 10) }}...</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="访问次数" prop="access_count" width="100" />
              <el-table-column label="创建时间" prop="created_at" width="180">
                <template #default="{ row }">
                  {{ formatDate(row.created_at) }}
                </template>
              </el-table-column>
              <el-table-column label="过期时间" prop="expires_at" width="180">
                <template #default="{ row }">
                  {{ row.expires_at ? formatDate(row.expires_at) : '永久有效' }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="isExpired(row) ? 'info' : 'success'">
                    {{ isExpired(row) ? '已过期' : '有效' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button size="small" type="primary" @click="copyShareLink(row)" link>
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-button>
                  <el-button size="small" type="danger" @click="deleteShare(row)" link>
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Download, Upload, Document, Picture, Printer, UploadFilled,
  Share, Key, Link, CopyDocument, List, Delete
} from '@element-plus/icons-vue';
import { exportApi, shareApi } from '../api';

const activeTab = ref('export');
const uploadRef = ref(null);
const selectedFile = ref(null);
const importing = ref(false);
const importResult = ref(null);

const exporting = reactive({
  gedcom: false,
  png: false,
  pdf: false
});

const creatingShare = ref(false);
const generatedLink = ref('');
const loadingShares = ref(false);
const shareLinks = ref([]);

const shareForm = reactive({
  name: '',
  expires_days: 7
});

const handleFileChange = (file) => {
  selectedFile.value = file.raw;
  importResult.value = null;
};

const handleBeforeRemove = () => {
  selectedFile.value = null;
  importResult.value = null;
  return true;
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const exportGedcom = async () => {
  exporting.gedcom = true;
  try {
    const blob = await exportApi.exportGedcom();
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `family-tree-${timestamp}.ged`);
    ElMessage.success('GEDCOM 导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败，请重试');
  } finally {
    exporting.gedcom = false;
  }
};

const exportPng = async () => {
  exporting.png = true;
  try {
    const blob = await exportApi.exportPng();
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `family-tree-${timestamp}.png`);
    ElMessage.success('PNG 导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败，请重试');
  } finally {
    exporting.png = false;
  }
};

const exportPdf = async () => {
  exporting.pdf = true;
  try {
    const blob = await exportApi.exportPdf();
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `family-tree-${timestamp}.pdf`);
    ElMessage.success('PDF 导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败，请重试');
  } finally {
    exporting.pdf = false;
  }
};

const importGedcom = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择要导入的文件');
    return;
  }

  importing.value = true;
  importResult.value = null;

  try {
    const text = await selectedFile.value.text();
    const result = await exportApi.importGedcom(text);
    importResult.value = { success: true, ...result };
    ElMessage.success('导入成功');
    uploadRef.value?.clearFiles();
    selectedFile.value = null;
  } catch (error) {
    console.error('导入失败:', error);
    importResult.value = { 
      success: false, 
      message: error.response?.data?.error || error.message 
    };
    ElMessage.error('导入失败');
  } finally {
    importing.value = false;
  }
};

const createShareLink = async () => {
  creatingShare.value = true;
  try {
    const result = await shareApi.create({
      name: shareForm.name,
      expires_days: shareForm.expires_days
    });
    
    const baseUrl = window.location.origin;
    generatedLink.value = `${baseUrl}/#/share/${result.token}`;
    
    ElMessage.success('分享链接生成成功');
    loadShareLinks();
  } catch (error) {
    console.error('生成分享链接失败:', error);
    ElMessage.error('生成失败，请重试');
  } finally {
    creatingShare.value = false;
  }
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    ElMessage.success('链接已复制到剪贴板');
  } catch (error) {
    ElMessage.error('复制失败，请手动复制');
  }
};

const copyShareLink = async (row) => {
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/#/share/${row.token}`;
  try {
    await navigator.clipboard.writeText(link);
    ElMessage.success('链接已复制到剪贴板');
  } catch (error) {
    ElMessage.error('复制失败，请手动复制');
  }
};

const deleteShare = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这个分享链接吗？', '确认删除', {
      type: 'warning'
    });
    await shareApi.delete(row.id);
    ElMessage.success('删除成功');
    loadShareLinks();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

const loadShareLinks = async () => {
  loadingShares.value = true;
  try {
    shareLinks.value = await shareApi.list();
  } catch (error) {
    console.error('加载分享列表失败:', error);
  } finally {
    loadingShares.value = false;
  }
};

const isExpired = (row) => {
  if (!row.expires_at) return false;
  return new Date(row.expires_at) < new Date();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  loadShareLinks();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.generated-link {
  margin-top: 20px;
  padding: 15px;
  background: #f0f9eb;
  border-radius: 8px;
}

.import-success {
  padding: 15px;
  background: #f0f9eb;
  border: 1px solid #c2e7b0;
  border-radius: 8px;
  margin-bottom: 15px;
}

.import-error {
  padding: 15px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 8px;
  margin-bottom: 15px;
}
</style>
