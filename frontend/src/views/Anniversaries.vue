<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">家族纪念日</h2>
      <div style="display: flex; gap: 10px; align-items: center">
        <el-date-picker
          v-model="currentMonth"
          type="month"
          placeholder="选择月份"
          format="YYYY年MM月"
          value-format="YYYY-MM"
          :clearable="false"
          @change="loadMonthlyData"
        />
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="calendar">
            <el-icon><Calendar /></el-icon>
            <span>日历视图</span>
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
            <span>列表视图</span>
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          <span>添加纪念日</span>
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="6">
        <div class="stat-card birthday-card">
          <div class="stat-icon">
            <el-icon :size="32"><Present /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月生日</div>
            <div class="stat-value">{{ monthlyStats.birthday_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card deathday-card">
          <div class="stat-icon">
            <el-icon :size="32"><BellFilled /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月忌日</div>
            <div class="stat-value">{{ monthlyStats.deathday_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card event-card">
          <div class="stat-icon">
            <el-icon :size="32"><StarFilled /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月家族大事</div>
            <div class="stat-value">{{ monthlyStats.family_event_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card wedding-card">
          <div class="stat-icon">
            <el-icon :size="32"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月结婚纪念</div>
            <div class="stat-value">{{ monthlyStats.wedding_count || 0 }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="18">
        <div class="filter-bar">
          <el-select v-model="filterPerson" placeholder="按人物筛选" clearable style="width: 150px" @change="loadMonthlyData">
            <el-option v-for="p in personList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-select v-model="filterType" placeholder="按类型筛选" clearable style="width: 150px" @change="loadMonthlyData">
            <el-option label="生日" value="生日" />
            <el-option label="忌日" value="忌日" />
            <el-option label="结婚纪念日" value="结婚纪念日" />
            <el-option label="迁居纪念" value="迁居纪念" />
            <el-option label="家族大事" value="家族大事" />
          </el-select>
        </div>

        <div v-if="viewMode === 'calendar'" class="calendar-container" v-loading="loading">
          <div class="calendar-header">
            <div v-for="day in weekDays" :key="day" class="calendar-weekday">{{ day }}</div>
          </div>
          <div class="calendar-grid">
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              class="calendar-day"
              :class="{
                'other-month': !day.isCurrentMonth,
                'today': day.isToday,
                'has-event': day.events && day.events.length > 0
              }"
            >
              <div class="day-number">{{ day.day }}</div>
              <div v-if="day.events && day.events.length > 0" class="day-events">
                <div
                  v-for="event in day.events.slice(0, 2)"
                  :key="event.id"
                  class="day-event"
                  :class="'event-' + getEventTypeClass(event.event_type)"
                  @click="viewAnniversaryDetail(event)"
                >
                  <span class="event-dot"></span>
                  <span class="event-text">{{ event.person_name }} {{ event.event_type }}</span>
                </div>
                <div v-if="day.events.length > 2" class="more-events">
                  +{{ day.events.length - 2 }} 更多
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="list-container" v-loading="loading">
          <el-table :data="filteredList" border stripe>
            <el-table-column prop="this_year_date" label="日期" width="120">
              <template #default="{ row }">
                <div style="font-weight: bold">{{ row.this_year_date }}</div>
                <div style="font-size: 12px; color: #909399">
                  原日期: {{ row.event_date }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="event_type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getEventTypeTag(row.event_type)" size="small">
                  {{ row.event_type }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="关联人物" width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px">
                  <el-avatar :size="24" :src="row.person_photo">
                    {{ row.person_name?.charAt(0) }}
                  </el-avatar>
                  <span>{{ row.person_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="days_until_next" label="距今天数" width="100">
              <template #default="{ row }">
                <el-tag :type="row.days_until_next === 0 ? 'danger' : row.days_until_next <= 7 ? 'warning' : 'info'" size="small">
                  {{ row.days_until_next === 0 ? '今天' : row.days_until_next + '天' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="is_lunar" label="历法" width="80">
              <template #default="{ row }">
                {{ row.is_lunar ? '农历' : '公历' }}
              </template>
            </el-table-column>
            <el-table-column prop="notes" label="备注" />
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="viewPersonDetail(row.person_id)">
                  人物详情
                </el-button>
                <el-button size="small" type="primary" link @click="openEditDialog(row)">
                  编辑
                </el-button>
                <el-button size="small" type="danger" link @click="handleDelete(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="6">
        <div class="upcoming-panel">
          <div class="panel-header">
            <el-icon><Bell /></el-icon>
            <span>未来30天提醒</span>
          </div>
          <div v-loading="upcomingLoading" class="panel-content">
            <div v-if="upcomingList.length === 0" class="empty-state">
              <el-icon :size="32"><Calendar /></el-icon>
              <p>未来30天暂无纪念日</p>
            </div>
            <div v-else class="upcoming-list">
              <div
                v-for="item in upcomingList"
                :key="item.id"
                class="upcoming-item"
                :class="{ 'today': item.days_until_next === 0 }"
                @click="viewAnniversaryDetail(item)"
              >
                <div class="upcoming-days">
                  <div class="days-number">{{ item.days_until_next === 0 ? '今' : item.days_until_next }}</div>
                  <div class="days-unit">{{ item.days_until_next === 0 ? '天' : '天后' }}</div>
                </div>
                <div class="upcoming-info">
                  <div class="upcoming-title">
                    <el-tag :type="getEventTypeTag(item.event_type)" size="small" style="margin-right: 5px">
                      {{ item.event_type }}
                    </el-tag>
                    {{ item.person_name }}
                  </div>
                  <div class="upcoming-date">{{ item.this_year_date }}</div>
                  <div v-if="item.notes" class="upcoming-notes">{{ item.notes }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑纪念日' : '添加纪念日'"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="关联人物" prop="person_id">
          <el-select v-model="formData.person_id" placeholder="请选择关联人物" filterable style="width: 100%">
            <el-option v-for="p in personList" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件类型" prop="event_type">
          <el-select v-model="formData.event_type" placeholder="请选择事件类型" style="width: 100%">
            <el-option label="生日" value="生日" />
            <el-option label="忌日" value="忌日" />
            <el-option label="结婚纪念日" value="结婚纪念日" />
            <el-option label="迁居纪念" value="迁居纪念" />
            <el-option label="家族大事" value="家族大事" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件日期" prop="event_date">
          <el-date-picker
            v-model="formData.event_date"
            type="date"
            placeholder="选择事件日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="历法">
          <el-radio-group v-model="formData.is_lunar">
            <el-radio :value="0">公历</el-radio>
            <el-radio :value="1">农历</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="重复规则">
          <el-select v-model="formData.repeat_rule" style="width: 100%">
            <el-option label="每年" value="yearly" />
            <el-option label="不重复" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="提醒提前">
          <el-input-number v-model="formData.reminder_days" :min="0" :max="30" style="width: 100%" />
          <span style="font-size: 12px; color: #909399">提前几天提醒（0-30天）</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="纪念日详情" width="500px">
      <div v-if="currentAnniversary">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="事件类型">
            <el-tag :type="getEventTypeTag(currentAnniversary.event_type)">
              {{ currentAnniversary.event_type }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="关联人物">
            <div style="display: flex; align-items: center; gap: 10px">
              <el-avatar :size="32" :src="currentAnniversary.person_photo">
                {{ currentAnniversary.person_name?.charAt(0) }}
              </el-avatar>
              <span style="font-weight: bold">{{ currentAnniversary.person_name }}</span>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="原始日期">
            {{ currentAnniversary.event_date }}
            <el-tag size="small" style="margin-left: 10px">
              {{ currentAnniversary.is_lunar ? '农历' : '公历' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="今年日期">
            {{ currentAnniversary.this_year_date }}
          </el-descriptions-item>
          <el-descriptions-item label="距离今天">
            <el-tag :type="currentAnniversary.days_until_next === 0 ? 'danger' : currentAnniversary.days_until_next <= 7 ? 'warning' : 'info'">
              {{ currentAnniversary.days_until_next === 0 ? '今天' : currentAnniversary.days_until_next + '天' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="重复规则">
            {{ currentAnniversary.repeat_rule === 'yearly' ? '每年' : '不重复' }}
          </el-descriptions-item>
          <el-descriptions-item label="提醒提前">
            {{ currentAnniversary.reminder_days }} 天
          </el-descriptions-item>
          <el-descriptions-item label="备注" v-if="currentAnniversary.notes">
            {{ currentAnniversary.notes }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="viewPersonDetail(currentAnniversary?.person_id)">
          查看人物详情
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Calendar, List, Plus, Present, BellFilled, StarFilled,
  Connection, Bell, User
} from '@element-plus/icons-vue';
import { anniversaryApi, personApi } from '@/api';

const loading = ref(false);
const upcomingLoading = ref(false);
const viewMode = ref('calendar');
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const filterPerson = ref(null);
const filterType = ref(null);

const personList = ref([]);
const monthlyData = ref([]);
const dayMap = ref({});
const monthlyStats = ref({});
const upcomingList = ref([]);

const dialogVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const formRef = ref(null);
const currentAnniversary = ref(null);

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const formData = reactive({
  person_id: null,
  event_type: '',
  event_date: '',
  is_lunar: 0,
  repeat_rule: 'yearly',
  reminder_days: 7,
  notes: ''
});

const formRules = {
  person_id: [{ required: true, message: '请选择关联人物', trigger: 'change' }],
  event_type: [{ required: true, message: '请选择事件类型', trigger: 'change' }],
  event_date: [{ required: true, message: '请选择事件日期', trigger: 'change' }]
};

const filteredList = computed(() => {
  let list = [...monthlyData.value];
  if (filterPerson.value) {
    list = list.filter(item => item.person_id === filterPerson.value);
  }
  if (filterType.value) {
    list = list.filter(item => item.event_type === filterType.value);
  }
  return list.sort((a, b) => a.days_until_next - b.days_until_next);
});

const calendarDays = computed(() => {
  const [year, month] = currentMonth.value.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = new Date();
  
  const days = [];
  
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      isToday: false,
      events: []
    });
  }
  
  const filterEvents = (events) => {
    let filtered = events;
    if (filterPerson.value) {
      filtered = filtered.filter(e => e.person_id === filterPerson.value);
    }
    if (filterType.value) {
      filtered = filtered.filter(e => e.event_type === filterType.value);
    }
    return filtered;
  };
  
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayEvents = dayMap.value[i] ? filterEvents(dayMap.value[i]) : [];
    const isToday = today.getFullYear() === year && 
                    today.getMonth() === month - 1 && 
                    today.getDate() === i;
    days.push({
      day: i,
      date: dateStr,
      isCurrentMonth: true,
      isToday,
      events: dayEvents
    });
  }
  
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      isToday: false,
      events: []
    });
  }
  
  return days;
});

function getEventTypeClass(type) {
  const map = {
    '生日': 'birthday',
    '忌日': 'deathday',
    '结婚纪念日': 'wedding',
    '迁居纪念': 'relocation',
    '家族大事': 'event'
  };
  return map[type] || 'default';
}

function getEventTypeTag(type) {
  const map = {
    '生日': 'success',
    '忌日': 'info',
    '结婚纪念日': 'danger',
    '迁居纪念': 'warning',
    '家族大事': 'primary'
  };
  return map[type] || '';
}

async function loadPersonList() {
  try {
    const result = await personApi.list({ pageSize: 100 });
    personList.value = result.data;
  } catch (err) {
    console.error('加载人物列表失败:', err);
  }
}

async function loadMonthlyData() {
  loading.value = true;
  try {
    const [year, month] = currentMonth.value.split('-').map(Number);
    const result = await anniversaryApi.monthly({ year, month });
    monthlyData.value = result.data || [];
    dayMap.value = result.day_map || {};
    monthlyStats.value = result.stats || {};
  } catch (err) {
    ElMessage.error('加载月度数据失败');
  } finally {
    loading.value = false;
  }
}

async function loadUpcoming() {
  upcomingLoading.value = true;
  try {
    const result = await anniversaryApi.upcoming({ days: 30 });
    upcomingList.value = result.data || [];
  } catch (err) {
    console.error('加载提醒数据失败:', err);
  } finally {
    upcomingLoading.value = false;
  }
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
  formData.person_id = null;
  formData.event_type = '';
  formData.event_date = '';
  formData.is_lunar = 0;
  formData.repeat_rule = 'yearly';
  formData.reminder_days = 7;
  formData.notes = '';
  if (formRef.value) formRef.value.resetFields();
}

async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) {
          await anniversaryApi.update(formData.id, formData);
          ElMessage.success('更新成功');
        } else {
          await anniversaryApi.create(formData);
          ElMessage.success('添加成功');
        }
        dialogVisible.value = false;
        loadMonthlyData();
        loadUpcoming();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    }
  });
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除"${row.person_name}的${row.event_type}"吗？`, '删除确认', { type: 'warning' });
    await anniversaryApi.delete(row.id);
    ElMessage.success('删除成功');
    loadMonthlyData();
    loadUpcoming();
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.response?.data?.error || '删除失败');
  }
}

function viewAnniversaryDetail(item) {
  currentAnniversary.value = item;
  detailVisible.value = true;
}

function viewPersonDetail(personId) {
  if (!personId) return;
  detailVisible.value = false;
  window.open(`/persons?id=${personId}`, '_blank');
}

onMounted(() => {
  loadPersonList();
  loadMonthlyData();
  loadUpcoming();
});
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  margin-right: 15px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.birthday-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.deathday-card {
  background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%);
}

.event-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.wedding-card {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  padding: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.calendar-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.calendar-weekday {
  text-align: center;
  font-weight: bold;
  padding: 10px;
  color: #606266;
  background: #f5f7fa;
  border-radius: 4px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  min-height: 100px;
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  transition: all 0.2s;
}

.calendar-day:hover {
  background: #f5f7fa;
}

.calendar-day.other-month {
  background: #fafafa;
  color: #c0c4cc;
}

.calendar-day.today {
  border-color: #409eff;
  background: #ecf5ff;
}

.calendar-day.has-event {
  background: #f0f9ff;
}

.day-number {
  font-weight: bold;
  margin-bottom: 5px;
}

.calendar-day.today .day-number {
  color: #409eff;
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.day-event {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.day-event.event-birthday {
  background: #f0f9eb;
  color: #67c23a;
}

.day-event.event-deathday {
  background: #f4f4f5;
  color: #909399;
}

.day-event.event-wedding {
  background: #fef0f0;
  color: #f56c6c;
}

.day-event.event-relocation {
  background: #fdf6ec;
  color: #e6a23c;
}

.day-event.event-event {
  background: #ecf5ff;
  color: #409eff;
}

.event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.event-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-events {
  font-size: 11px;
  color: #909399;
  padding-left: 10px;
}

.list-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.upcoming-panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
}

.panel-content {
  padding: 15px;
  max-height: 600px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

.empty-state .el-icon {
  margin-bottom: 10px;
  color: #dcdfe6;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upcoming-item {
  display: flex;
  gap: 15px;
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.2s;
}

.upcoming-item:hover {
  background: #ecf5ff;
  transform: translateX(3px);
}

.upcoming-item.today {
  background: #fef0f0;
  border: 1px solid #f56c6c;
}

.upcoming-days {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  padding: 8px;
  background: #fff;
  border-radius: 8px;
}

.upcoming-item.today .upcoming-days {
  background: #f56c6c;
  color: #fff;
}

.days-number {
  font-size: 20px;
  font-weight: bold;
  line-height: 1;
}

.days-unit {
  font-size: 11px;
  margin-top: 2px;
}

.upcoming-info {
  flex: 1;
  min-width: 0;
}

.upcoming-title {
  font-weight: bold;
  margin-bottom: 3px;
}

.upcoming-date {
  font-size: 12px;
  color: #909399;
  margin-bottom: 3px;
}

.upcoming-notes {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
