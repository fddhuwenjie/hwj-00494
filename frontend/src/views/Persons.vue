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
      <el-table-column prop="name" label="姓名" width="100">
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
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" type="primary" link @click="viewDetail(row)">
              详情
            </el-button>
            <el-button size="small" type="primary" link @click="openEditDialog(row)">
              编辑
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

    <el-dialog v-model="detailVisible" title="成员详情" width="700px">
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

        <div v-if="currentPerson.spouses && currentPerson.spouses.length > 0" class="detail-section">
          <h3 class="detail-section-title">配偶</h3>
          <div style="display: flex; gap: 15px; flex-wrap: wrap">
            <div v-for="spouse in currentPerson.spouses" :key="spouse.id"
                 style="display: flex; align-items: center; gap: 8px; padding: 10px; background: #fef0f0; border-radius: 8px">
              <el-avatar :size="32" :src="spouse.photo_url">
                {{ spouse.spouse_name.charAt(0) }}
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
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useFamilyStore } from '@/stores/family';

const store = useFamilyStore();

const loading = ref(false);
const searchName = ref('');
const searchGender = ref('');
const tableData = ref([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const currentPerson = ref(null);
const formRef = ref(null);

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
    
    const result = await store.loadPersons(params);
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
    detailVisible.value = true;
  } catch (err) {
    ElMessage.error('加载详情失败');
  }
}
</script>
