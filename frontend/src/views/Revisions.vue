<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">修订中心</h2>
      <div>
        <el-button type="primary" @click="loadData">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </div>
    </div>

    <div class="search-bar">
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable style="width: 140px">
        <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <el-select v-model="filterTargetType" placeholder="目标类型" clearable style="width: 140px">
        <el-option label="人物" value="person" />
        <el-option label="婚姻" value="marriage" />
        <el-option label="亲子关系" value="relationship" />
      </el-select>
      <el-input v-model="filterSubmitter" placeholder="申请人" clearable style="width: 160px" @keyup.enter="loadData" />
      <el-input v-model="filterPersonName" placeholder="关联人物姓名" clearable style="width: 180px" @keyup.enter="loadData" />
      <el-button type="primary" @click="loadData">搜索</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="目标" width="180">
        <template #default="{ row }">
          <el-tag size="small" style="margin-right: 8px">
            {{ row.target_type === 'person' ? '人物' : row.target_type === 'marriage' ? '婚姻' : '关系' }}
          </el-tag>
          <span>{{ row.target_name || '新建' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-tag :type="row.action === 'create' ? 'success' : row.action === 'delete' ? 'danger' : ''" size="small">
            {{ row.action === 'create' ? '新建' : row.action === 'delete' ? '删除' : '更新' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申请理由" show-overflow-tooltip min-width="200" />
      <el-table-column prop="submitter" label="申请人" width="120" />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag
            :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : row.status === 'need_more_info' ? 'warning' : 'info'"
            size="small"
          >
            {{ row.status_label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="submitted_at" label="提交时间" width="170" />
      <el-table-column prop="reviewed_at" label="审核时间" width="170">
        <template #default="{ row }">
          <span>{{ row.reviewed_at || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" type="primary" link @click="viewDetail(row)">查看</el-button>
            <el-button size="small" type="success" link v-if="row.status === 'pending' || row.status === 'need_more_info'" @click="openReviewDialog(row, 'approved')">
              通过
            </el-button>
            <el-button size="small" type="danger" link v-if="row.status === 'pending' || row.status === 'need_more_info'" @click="openReviewDialog(row, 'rejected')">
              拒绝
            </el-button>
            <el-button size="small" type="warning" link v-if="row.status === 'pending'" @click="openReviewDialog(row, 'need_more_info')">
              需补充
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      style="margin-top: 20px; justify-content: flex-end"
      @size-change="handleSizeChange"
      @current-change="handlePageChange"
    />

    <el-dialog v-model="detailVisible" :title="`修订申请 #${currentRevision?.id}`" width="800px" @close="resetDetail">
      <div v-if="currentRevision">
        <el-descriptions :column="2" border style="margin-bottom: 20px">
          <el-descriptions-item label="目标类型">
            {{ currentRevision.target_type === 'person' ? '人物' : currentRevision.target_type === 'marriage' ? '婚姻' : '关系' }}
          </el-descriptions-item>
          <el-descriptions-item label="目标ID">
            {{ currentRevision.target_id || '新建（无ID）' }}
          </el-descriptions-item>
          <el-descriptions-item label="操作">
            {{ currentRevision.action === 'create' ? '新建' : currentRevision.action === 'delete' ? '删除' : '更新' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="currentRevision.status === 'approved' ? 'success' : currentRevision.status === 'rejected' ? 'danger' : currentRevision.status === 'need_more_info' ? 'warning' : 'info'"
              size="small"
            >
              {{ currentRevision.status_label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ currentRevision.submitter }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ currentRevision.submitted_at }}
          </el-descriptions-item>
          <el-descriptions-item label="审核人" v-if="currentRevision.reviewer">
            {{ currentRevision.reviewer }}
          </el-descriptions-item>
          <el-descriptions-item label="审核时间" v-if="currentRevision.reviewed_at">
            {{ currentRevision.reviewed_at }}
          </el-descriptions-item>
          <el-descriptions-item label="申请理由" :span="2">
            {{ currentRevision.reason }}
          </el-descriptions-item>
          <el-descriptions-item label="审核备注" :span="2" v-if="currentRevision.review_notes">
            {{ currentRevision.review_notes }}
          </el-descriptions-item>
        </el-descriptions>

        <el-tabs v-model="detailTab" type="border-card">
          <el-tab-pane label="变更内容" name="diff">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px">
              <div>
                <div style="font-weight: bold; color: #f56c6c; margin-bottom: 10px">变更前</div>
                <pre style="background: #fef0f0; padding: 15px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow: auto">{{ JSON.stringify(currentRevision.before_data, null, 2) || '无' }}</pre>
              </div>
              <div>
                <div style="font-weight: bold; color: #67c23a; margin-bottom: 10px">变更后</div>
                <pre style="background: #f0f9eb; padding: 15px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow: auto">{{ JSON.stringify(currentRevision.after_data, null, 2) }}</pre>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="关联证据" name="evidence">
            <div v-if="!currentRevision.evidence || currentRevision.evidence.length === 0" class="empty-state">
              <el-icon class="empty-icon"><Document /></el-icon>
              <p>未关联证据</p>
            </div>
            <el-table v-else :data="currentRevision.evidence" border stripe>
              <el-table-column prop="evidence_type" label="资料类型" width="120">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.evidence_type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="source_title" label="来源标题" />
              <el-table-column prop="credibility" label="可信度" width="120">
                <template #default="{ row }">
                  <el-rate v-model="row.credibility" disabled size="small" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link v-if="row.source_url" @click="window.open(row.source_url)">查看</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="评论" name="comments">
            <div style="margin-bottom: 15px">
              <div style="display: flex; gap: 10px; margin-bottom: 10px">
                <el-input v-model="newComment.author" placeholder="您的姓名" style="width: 150px" />
                <el-input v-model="newComment.content" placeholder="发表评论..." @keyup.enter="submitComment" />
                <el-button type="primary" @click="submitComment">发送</el-button>
              </div>
            </div>
            <div v-if="currentRevision.comments.length === 0" class="empty-state">
              <el-icon class="empty-icon"><ChatDotRound /></el-icon>
              <p>暂无评论</p>
            </div>
            <div v-else>
              <div v-for="c in currentRevision.comments" :key="c.id" style="padding: 12px; border-bottom: 1px solid #ebeef5">
                <div style="margin-bottom: 5px">
                  <span style="font-weight: bold">{{ c.author }}</span>
                  <span style="margin-left: 10px; color: #909399; font-size: 12px">{{ c.created_at }}</span>
                </div>
                <div style="color: #606266">{{ c.content }}</div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="currentRevision && (currentRevision.status === 'pending' || currentRevision.status === 'need_more_info')" type="success" @click="openReviewDialog(currentRevision, 'approved')">
          通过
        </el-button>
        <el-button v-if="currentRevision && (currentRevision.status === 'pending' || currentRevision.status === 'need_more_info')" type="danger" @click="openReviewDialog(currentRevision, 'rejected')">
          拒绝
        </el-button>
        <el-button v-if="currentRevision && currentRevision.status === 'pending'" type="warning" @click="openReviewDialog(currentRevision, 'need_more_info')">
          需补充
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" :title="reviewDialogTitle" width="500px">
      <el-form :model="reviewForm" ref="reviewFormRef" label-width="100px">
        <el-form-item label="审核人">
          <el-input v-model="reviewForm.reviewer" placeholder="请输入审核人姓名" />
        </el-form-item>
        <el-form-item label="审核备注">
          <el-input
            v-model="reviewForm.review_notes"
            type="textarea"
            :rows="3"
            placeholder="请输入审核意见"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReview">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { revisionApi } from '@/api';

const loading = ref(false);
const tableData = ref([]);
const detailVisible = ref(false);
const reviewDialogVisible = ref(false);
const currentRevision = ref(null);
const detailTab = ref('diff');
const statusOptions = ref([]);

const filterStatus = ref('');
const filterTargetType = ref('');
const filterSubmitter = ref('');
const filterPersonName = ref('');

const reviewTarget = ref(null);
const reviewStatus = ref('');
const reviewForm = reactive({
  reviewer: '管理员',
  review_notes: ''
});
const reviewFormRef = ref(null);

const newComment = reactive({
  author: '',
  content: ''
});

const reviewDialogTitle = computed(() => {
  if (reviewStatus.value === 'approved') return '审核通过';
  if (reviewStatus.value === 'rejected') return '审核拒绝';
  return '要求补充';
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

onMounted(() => {
  loadStatuses();
  loadData();
});

async function loadStatuses() {
  try {
    const result = await revisionApi.getStatuses();
    statusOptions.value = result.statuses || [];
  } catch (err) {
    statusOptions.value = [
      { value: 'pending', label: '待审核' },
      { value: 'need_more_info', label: '需补充' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已拒绝' }
    ];
  }
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterTargetType.value) params.target_type = filterTargetType.value;
    if (filterSubmitter.value) params.submitter = filterSubmitter.value;
    if (filterPersonName.value) params.person_name = filterPersonName.value;

    const result = await revisionApi.list(params);
    tableData.value = result.data || [];
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filterStatus.value = '';
  filterTargetType.value = '';
  filterSubmitter.value = '';
  filterPersonName.value = '';
  pagination.page = 1;
  loadData();
}

function handleSizeChange(size) {
  pagination.pageSize = size;
  pagination.page = 1;
  loadData();
}

function handlePageChange(page) {
  pagination.page = page;
  loadData();
}

async function viewDetail(row) {
  try {
    currentRevision.value = await revisionApi.detail(row.id);
    detailTab.value = 'diff';
    detailVisible.value = true;
  } catch (err) {
    ElMessage.error('加载详情失败');
  }
}

function resetDetail() {
  currentRevision.value = null;
  newComment.author = '';
  newComment.content = '';
}

function openReviewDialog(row, status) {
  reviewTarget.value = row;
  reviewStatus.value = status;
  reviewForm.reviewer = '管理员';
  reviewForm.review_notes = '';
  reviewDialogVisible.value = true;
}

async function submitReview() {
  try {
    const target = reviewTarget.value;
    const status = reviewStatus.value;
    await ElMessageBox.confirm(
      `确定要将此修订申请标记为"${status === 'approved' ? '已通过' : status === 'rejected' ? '已拒绝' : '需补充'}"吗？`,
      '审核确认',
      { type: 'warning' }
    );

    await revisionApi.review(target.id, {
      status,
      reviewer: reviewForm.reviewer,
      review_notes: reviewForm.review_notes
    });

    ElMessage.success(status === 'approved' ? '已通过审核' : status === 'rejected' ? '已拒绝申请' : '已要求补充');
    reviewDialogVisible.value = false;
    if (detailVisible.value && currentRevision.value?.id === target.id) {
      viewDetail(target);
    }
    loadData();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '审核失败');
    }
  }
}

async function submitComment() {
  if (!newComment.content) {
    ElMessage.warning('请输入评论内容');
    return;
  }
  if (!currentRevision.value) return;

  try {
    await revisionApi.addComment(currentRevision.value.id, {
      author: newComment.author || '匿名',
      content: newComment.content
    });
    ElMessage.success('评论已发送');
    newComment.content = '';
    viewDetail(currentRevision.value);
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '评论失败');
  }
}
</script>

<style>
pre {
  font-family: 'Courier New', monospace;
  margin: 0;
}
</style>
