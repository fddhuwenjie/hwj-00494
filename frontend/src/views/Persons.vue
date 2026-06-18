<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">人物管理</h2>
      <el-button type="primary" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        <span>添加成员</span>
      </el-button>
    </div>

    <div class="search-bar">
      <el-input
        v-model="searchName"
        placeholder="搜索姓名"
        clearable
        style="width: 200px"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="searchGender" placeholder="性别筛选" clearable style="width: 120px">
        <el-option label="男" value="男" />
        <el-option label="女" value="女" />
      </el-select>
      <el-button type="primary" @click="handleSearch">搜索</el-button>
      <el-button @click="resetSearch">重置</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" border stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="姓名" width="120">
        <template #default="{ row }">
          <el-avatar :size="24" :src="row.photo_url" style="margin-right: 8px">
            {{ row.name.charAt(0) }}
          </el-avatar>
          {{ row.name }}
        </template>
      </el-table-column>
      <el-table-column prop="gender" label="性别" width="80">
        <template #default="{ row }">
          <el-tag :class="row.gender === '男' ? 'male-tag' : 'female-tag'" size="small">
            {{ row.gender }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="birth_date" label="出生日期" width="120" />
      <el-table-column prop="death_date" label="去世日期" width="120">
        <template #default="{ row }">
          <span v-if="row.death_date">{{ row.death_date }}</span>
          <span v-else class="alive-tag" style="padding: 2px 8px; border-radius: 4px; font-size: 12px">在世</span>
        </template>
      </el-table-column>
      <el-table-column prop="hometown" label="籍贯" width="150" />
      <el-table-column prop="occupation" label="职业" width="120" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :class="row.is_deceased ? 'deceased-tag' : 'alive-tag'" size="small">
            {{ row.is_deceased ? '已故' : '在世' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" type="primary" link @click="viewDetail(row)">
              详情
            </el-button>
            <el-button size="small" type="primary" link @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button size="small" type="warning" link @click="openRevisionDialog(row)">
              申请修订
            </el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">
              删除
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

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑成员' : '添加成员'"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="formData.gender">
            <el-radio label="男">男</el-radio>
            <el-radio label="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker
            v-model="formData.birth_date"
            type="date"
            placeholder="选择出生日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="去世日期">
          <el-date-picker
            v-model="formData.death_date"
            type="date"
            placeholder="选择去世日期（可选）"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="照片URL">
          <el-input v-model="formData.photo_url" placeholder="请输入照片URL（可选）" />
        </el-form-item>
        <el-form-item label="籍贯">
          <el-input v-model="formData.hometown" placeholder="请输入籍贯（可选）" />
        </el-form-item>
        <el-form-item label="职业">
          <el-input v-model="formData.occupation" placeholder="请输入职业（可选）" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="formData.bio"
            type="textarea"
            :rows="3"
            placeholder="请输入简介（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="成员详情" width="900px">
      <div v-if="currentPerson">
        <div style="display: flex; gap: 20px; margin-bottom: 20px">
          <el-avatar :size="100" :src="currentPerson.photo_url">
            {{ currentPerson.name.charAt(0) }}
          </el-avatar>
          <div style="flex: 1">
            <h2 style="margin-bottom: 10px">
              {{ currentPerson.name }}
              <el-tag :class="currentPerson.gender === '男' ? 'male-tag' : 'female-tag'" style="margin-left: 10px">
                {{ currentPerson.gender }}
              </el-tag>
              <el-tag :class="currentPerson.is_deceased ? 'deceased-tag' : 'alive-tag'" style="margin-left: 10px">
                {{ currentPerson.is_deceased ? '已故' : '在世' }}
              </el-tag>
            </h2>
            <p style="color: #909399; margin-bottom: 5px">
              {{ currentPerson.birth_date || '出生日期未知' }}
              <span v-if="currentPerson.death_date"> - {{ currentPerson.death_date }}</span>
            </p>
            <p v-if="currentPerson.occupation" style="color: #606266">
              {{ currentPerson.occupation }}
            </p>
          </div>
        </div>

        <el-tabs v-model="detailTab" type="border-card">
          <el-tab-pane label="基本信息" name="basic">
            <div v-if="currentPerson.bio" class="detail-section">
              <h3 class="detail-section-title">个人简介</h3>
              <p style="line-height: 1.8; color: #606266">{{ currentPerson.bio }}</p>
            </div>

            <div class="detail-section">
              <h3 class="detail-section-title">基本信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">籍贯</span>
                  <span class="info-value">{{ currentPerson.hometown || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">出生日期</span>
                  <span class="info-value">{{ currentPerson.birth_date || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">去世日期</span>
                  <span class="info-value">{{ currentPerson.death_date || '-' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">职业</span>
                  <span class="info-value">{{ currentPerson.occupation || '-' }}</span>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.parents && currentPerson.parents.length > 0" class="detail-section">
              <h3 class="detail-section-title">父母</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div v-for="parent in currentPerson.parents" :key="parent.id"
                     style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #f5f7fa; border-radius: 8px">
                  <el-avatar :size="32" :src="parent.photo_url">
                    {{ parent.name.charAt(0) }}
                  </el-avatar>
                  <div>
                    <div style="font-weight: bold">{{ parent.name }}</div>
                    <div style="font-size: 12px; color: #909399">{{ parent.relationship_type }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.marriages && currentPerson.marriages.length > 0" class="detail-section">
              <h3 class="detail-section-title">配偶</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div v-for="spouse in currentPerson.marriages" :key="spouse.id"
                     style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #fef0f0; border-radius: 8px">
                  <el-avatar :size="32" :src="spouse.photo_url">
                    {{ spouse.spouse_name?.charAt(0) }}
                  </el-avatar>
                  <div>
                    <div style="font-weight: bold">{{ spouse.spouse_name }}</div>
                    <div style="font-size: 12px; color: #909399">
                      第{{ spouse.marriage_order }}段婚姻
                      <span v-if="spouse.marriage_date"> · {{ spouse.marriage_date }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.children && currentPerson.children.length > 0" class="detail-section">
              <h3 class="detail-section-title">子女</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div v-for="child in currentPerson.children" :key="child.id"
                     style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #ecf5ff; border-radius: 8px">
                  <el-avatar :size="32" :src="child.photo_url">
                    {{ child.name.charAt(0) }}
                  </el-avatar>
                  <div>
                    <div style="font-weight: bold">{{ child.name }}</div>
                    <div style="font-size: 12px; color: #909399">
                      {{ child.relationship_type }}
                      <span v-if="child.birth_date"> · {{ child.birth_date }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.siblings && currentPerson.siblings.length > 0" class="detail-section">
              <h3 class="detail-section-title">兄弟姐妹</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div v-for="sibling in currentPerson.siblings" :key="sibling.id"
                     style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #f0f9eb; border-radius: 8px">
                  <el-avatar :size="32" :src="sibling.photo_url">
                    {{ sibling.name.charAt(0) }}
                  </el-avatar>
                  <div>
                    <div style="font-weight: bold">{{ sibling.name }}</div>
                    <div style="font-size: 12px; color: #909399">
                      {{ sibling.gender === '男' ? '兄弟' : '姐妹' }}
                      <span v-if="sibling.birth_date"> · {{ sibling.birth_date }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="考证证据" name="evidence">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
              <h3 class="detail-section-title" style="margin-bottom: 0">证据资料</h3>
                <el-button type="primary" size="small" @click="openEvidenceDialog">
                  <el-icon><Plus /></el-icon> 上传证据
                </el-button>
              </div>
              <div v-if="personEvidence.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Document /></el-icon>
                <p>暂无证据资料，点击上方按钮添加</p>
              </div>
              <el-table v-else :data="personEvidence" border stripe>
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
                <el-table-column prop="photo_date" label="拍摄日期" width="120" />
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" link v-if="row.source_url" @click="window.open(row.source_url)">查看来源</el-button>
                    <el-button size="small" type="danger" link @click="deleteEvidence(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="历史版本" name="history">
            <div class="detail-section">
              <h3 class="detail-section-title">变更历史</h3>
              <div v-if="changeLogs.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Clock /></el-icon>
                <p>暂无变更记录</p>
              </div>
              <el-timeline v-else>
                <el-timeline-item
                  v-for="log in changeLogs"
                  :key="log.id"
                  :timestamp="log.created_at"
                  :type="log.action === 'create' ? 'success' : log.action === 'delete' ? 'danger' : log.action === 'rollback' ? 'warning' : 'primary'"
                  placement="top"
                >
                  <el-card shadow="never" style="margin-bottom: 10px">
                  <div style="margin-bottom: 10px">
                    <el-tag :type="log.action === 'create' ? 'success' : log.action === 'delete' ? 'danger' : log.action === 'rollback' ? 'warning' : ''">
                      {{ log.action === 'create' ? '创建' : log.action === 'delete' ? '删除' : log.action === 'rollback' ? '回滚' : '更新' }}
                    </el-tag>
                    <span style="margin-left: 10px; color: #909399">操作人：{{ log.operator || '系统' }}</span>
                    <span v-if="log.notes" style="margin-left: 10px; color: #606266">{{ log.notes }}</span>
                  </div>
                  <div v-if="log.before_data" style="margin-bottom: 10px">
                    <div style="color: #f56c6c; font-size: 13px">变更前：</div>
                    <pre style="background: #fef0f0; padding: 10px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all">{{ JSON.stringify(log.before_data, null, 2) }}</pre>
                  </div>
                  <div v-if="log.after_data">
                    <div style="color: #67c23a; font-size: 13px">变更后：</div>
                    <pre style="background: #f0f9eb; padding: 10px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all">{{ JSON.stringify(log.after_data, null, 2) }}</pre>
                  </div>
                  <div style="margin-top: 10px">
                    <el-button size="small" type="warning" @click="handleRollback(log)" v-if="log.action !== 'rollback'">
                      <el-icon><RefreshLeft /></el-icon> 回滚到此版本
                    </el-button>
                  </div>
                </el-card>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="evidenceDialogVisible" title="上传证据" width="500px" @close="resetEvidenceForm">
      <el-form :model="evidenceForm" :rules="evidenceRules" ref="evidenceFormRef" label-width="100px">
        <el-form-item label="资料类型" prop="evidence_type">
          <el-select v-model="evidenceForm.evidence_type" placeholder="请选择资料类型" style="width: 100%">
            <el-option label="出生证明" value="出生证明" />
            <el-option label="死亡证明" value="死亡证明" />
            <el-option label="结婚证" value="结婚证" />
            <el-option label="家谱" value="家谱" />
            <el-option label="户籍" value="户籍" />
            <el-option label="照片" value="照片" />
            <el-option label="采访记录" value="采访记录" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源标题" prop="source_title">
          <el-input v-model="evidenceForm.source_title" placeholder="请输入来源标题" />
        </el-form-item>
        <el-form-item label="来源链接">
          <el-input v-model="evidenceForm.source_url" placeholder="请输入来源链接（可选）" />
        </el-form-item>
        <el-form-item label="拍摄日期">
          <el-date-picker
            v-model="evidenceForm.photo_date"
            type="date"
            placeholder="选择拍摄日期（可选）"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="可信度" prop="credibility">
          <el-rate v-model="evidenceForm.credibility" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="evidenceForm.notes"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="evidenceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEvidenceSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="revisionDialogVisible" title="申请修订" width="700px" @close="resetRevisionForm">
      <el-form :model="revisionForm" :rules="revisionRules" ref="revisionFormRef" label-width="100px">
        <div style="background: #ecf5ff; padding: 15px; border-radius: 8px; margin-bottom: 15px">
          <div style="font-weight: bold; margin-bottom: 10px">变更内容</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px">
            <div>
              <div style="color: #909399; font-size: 12px; margin-bottom: 5px">变更前（只读）</div>
              <pre style="background: #f5f7fa; padding: 10px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 250px; overflow: auto">{{ JSON.stringify(revisionForm.before_data, null, 2) }}</pre>
            </div>
            <div>
              <div style="color: #67c23a; font-size: 12px; margin-bottom: 5px">变更后（可编辑 JSON）</div>
              <el-input
                v-model="revisionAfterJson"
                type="textarea"
                :rows="15"
                style="font-family: 'Courier New', monospace; font-size: 11px"
              />
            </div>
          </div>
        </div>
        <el-form-item label="申请理由" prop="reason">
          <el-input
            v-model="revisionForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请说明修订的详细理由"
          />
        </el-form-item>
        <el-form-item label="提交人">
          <el-input v-model="revisionForm.submitter" placeholder="请输入您的姓名" />
        </el-form-item>
        <el-form-item label="冲突检测">
          <el-button type="primary" size="small" @click="checkConflicts">运行冲突检测</el-button>
          <div v-if="conflictResult.conflicts && conflictResult.conflicts.length > 0" style="margin-top: 10px">
            <el-alert
              v-for="(c, idx) in conflictResult.conflicts"
              :key="idx"
              :title="c.message"
              :type="c.severity === 'error' ? 'error' : 'warning'"
              :closable="false"
              style="margin-bottom: 8px"
            />
          </div>
          <div v-else-if="conflictResult.checked" style="margin-top: 10px">
            <el-alert title="未检测到冲突" type="success" :closable="false" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="revisionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRevision">提交申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useFamilyStore } from '@/stores/family';
import { evidenceApi, revisionApi } from '@/api';

const store = useFamilyStore();

const loading = ref(false);
const searchName = ref('');
const searchGender = ref('');
const tableData = ref([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const evidenceDialogVisible = ref(false);
const revisionDialogVisible = ref(false);
const isEdit = ref(false);
const currentPerson = ref(null);
const formRef = ref(null);
const evidenceFormRef = ref(null);
const revisionFormRef = ref(null);
const detailTab = ref('basic');
const personEvidence = ref([]);
const changeLogs = ref([]);
const conflictResult = reactive({ checked: false, conflicts: [] });
const revisionAfterJson = ref('');

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const formData = reactive({
  name: '',
  gender: '男',
  birth_date: '',
  death_date: '',
  photo_url: '',
  hometown: '',
  occupation: '',
  bio: ''
});

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }]
};

const evidenceForm = reactive({
  evidence_type: '',
  source_title: '',
  source_url: '',
  photo_date: '',
  credibility: 3,
  notes: ''
});

const evidenceRules = {
  evidence_type: [{ required: true, message: '请选择资料类型', trigger: 'change' }],
  source_title: [{ required: true, message: '请输入来源标题', trigger: 'blur' }]
};

const revisionForm = reactive({
  target_type: 'person',
  target_id: null,
  action: 'update',
  before_data: {},
  after_data: {},
  reason: '',
  submitter: '普通成员'
});

const revisionRules = {
  reason: [{ required: true, message: '请输入申请理由', trigger: 'blur' }]
};

onMounted(() => {
  loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize
    };
    if (searchName.value) params.name = searchName.value;

    let result = await store.loadPersons(params);
    if (searchGender.value) {
      result.data = result.data.filter(p => p.gender === searchGender.value);
      result.pagination.total = result.data.length;
    }
    tableData.value = result.data;
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  loadData();
}

function resetSearch() {
  searchName.value = '';
  searchGender.value = '';
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

function openAddDialog() {
  isEdit.value = false;
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(row) {
  isEdit.value = true;
  Object.assign(formData, row);
  dialogVisible.value = true;
}

function resetForm() {
  formData.name = '';
  formData.gender = '男';
  formData.birth_date = '';
  formData.death_date = '';
  formData.photo_url = '';
  formData.hometown = '';
  formData.occupation = '';
  formData.bio = '';
  if (formRef.value) {
    formRef.value.resetFields();
  }
}

async function handleSubmit() {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) {
          await store.updatePerson(formData.id, formData);
          ElMessage.success('更新成功');
        } else {
          await store.createPerson(formData);
          ElMessage.success('添加成功');
        }
        dialogVisible.value = false;
        loadData();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    }
  });
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除成员"${row.name}"吗？`, '删除确认', {
      type: 'warning'
    });
    await store.deletePerson(row.id);
    ElMessage.success('删除成功');
    loadData();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '删除失败');
    }
  }
}

async function viewDetail(row) {
  try {
    currentPerson.value = await store.loadPersonDetail(row.id);
    detailTab.value = 'basic';
    detailVisible.value = true;
    loadPersonEvidence(row.id);
    loadChangeLogs(row.id);
  } catch (err) {
    ElMessage.error('加载详情失败');
  }
}

async function loadPersonEvidence(personId) {
  try {
    const result = await evidenceApi.byTarget('person', personId);
    personEvidence.value = result.data || [];
  } catch (err) {
    personEvidence.value = [];
  }
}

async function loadChangeLogs(personId) {
  try {
    const result = await revisionApi.getChangeLogs('person', personId);
    changeLogs.value = result.data || [];
  } catch (err) {
    changeLogs.value = [];
  }
}

function openEvidenceDialog() {
  resetEvidenceForm();
  evidenceDialogVisible.value = true;
}

function resetEvidenceForm() {
  evidenceForm.evidence_type = '';
  evidenceForm.source_title = '';
  evidenceForm.source_url = '';
  evidenceForm.photo_date = '';
  evidenceForm.credibility = 3;
  evidenceForm.notes = '';
  if (evidenceFormRef.value) {
    evidenceFormRef.value.resetFields();
  }
}

async function handleEvidenceSubmit() {
  if (!evidenceFormRef.value) return;
  await evidenceFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await evidenceApi.create({
          target_type: 'person',
          target_id: currentPerson.value.id,
          ...evidenceForm
        });
        ElMessage.success('证据上传成功');
        evidenceDialogVisible.value = false;
        loadPersonEvidence(currentPerson.value.id);
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '上传失败');
      }
    }
  });
}

async function deleteEvidence(row) {
  try {
    await ElMessageBox.confirm('确定要删除该证据吗？', '删除确认', { type: 'warning' });
    await evidenceApi.delete(row.id);
    ElMessage.success('删除成功');
    loadPersonEvidence(currentPerson.value.id);
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '删除失败');
    }
  }
}

function openRevisionDialog(row) {
  revisionForm.target_id = row.id;
  revisionForm.before_data = { ...row };
  revisionForm.after_data = { ...row };
  revisionForm.reason = '';
  revisionAfterJson.value = JSON.stringify(row, null, 2);
  conflictResult.checked = false;
  conflictResult.conflicts = [];
  revisionDialogVisible.value = true;
}

function resetRevisionForm() {
  revisionForm.target_id = null;
  revisionForm.before_data = {};
  revisionForm.after_data = {};
  revisionForm.reason = '';
  revisionAfterJson.value = '';
  conflictResult.checked = false;
  conflictResult.conflicts = [];
  if (revisionFormRef.value) {
    revisionFormRef.value.resetFields();
  }
}

async function checkConflicts() {
  try {
    let afterData;
    try {
      afterData = JSON.parse(revisionAfterJson.value);
    } catch (e) {
      ElMessage.error('JSON格式错误，请检查变更后数据');
      return;
    }
    const result = await revisionApi.detectConflicts({
      target_type: 'person',
      target_id: revisionForm.target_id,
      data: afterData
    });
    conflictResult.checked = true;
    conflictResult.conflicts = result.conflicts || [];
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '冲突检测失败');
  }
}

async function submitRevision() {
  if (!revisionFormRef.value) return;
  await revisionFormRef.value.validate(async (valid) => {
    if (valid) {
      let afterData;
      try {
        afterData = JSON.parse(revisionAfterJson.value);
      } catch (e) {
        ElMessage.error('JSON格式错误，请检查变更后数据');
        return;
      }
      try {
        await revisionApi.create({
          target_type: 'person',
          target_id: revisionForm.target_id,
          action: 'update',
          before_data: revisionForm.before_data,
          after_data: afterData,
          reason: revisionForm.reason,
          submitter: revisionForm.submitter,
          run_conflict_check: true
        });
        ElMessage.success('修订申请已提交，请等待审核');
        revisionDialogVisible.value = false;
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '提交失败');
      }
    }
  });
}

async function handleRollback(log) {
  try {
    await ElMessageBox.confirm('确定要回滚到此版本吗？当前数据将被替换。', '回滚确认', {
      type: 'warning'
    });
    await revisionApi.rollback(log.id, { operator: '管理员' });
    ElMessage.success('回滚成功');
    loadChangeLogs(currentPerson.value.id);
    viewDetail(currentPerson.value);
    loadData();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '回滚失败');
    }
  }
}
</script>

<style>
pre {
  font-family: 'Courier New', monospace;
  margin: 0;
}
</style>
