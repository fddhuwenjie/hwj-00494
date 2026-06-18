<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">搜索查询</h2>
    </div>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="姓名搜索" name="name">
        <div class="search-bar">
          <el-input
            v-model="searchName"
            placeholder="请输入姓名关键词"
            clearable
            style="width: 300px"
            @keyup.enter="handleNameSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="handleNameSearch">搜索</el-button>
        </div>

        <div v-if="searchResults.length > 0">
          <el-table :data="searchResults" border stripe>
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
            <el-table-column prop="hometown" label="籍贯" width="150" />
            <el-table-column prop="occupation" label="职业" width="120" />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :class="row.is_deceased ? 'deceased-tag' : 'alive-tag'" size="small">
                  {{ row.is_deceased ? '已故' : '在世' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button type="primary" link @click="viewPersonDetail(row)">查看详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else-if="hasSearched" class="empty-state">
          <el-icon class="empty-icon"><Search /></el-icon>
          <p>未找到匹配的人员</p>
        </div>
      </el-tab-pane>

      <el-tab-pane label="关系路径查询" name="relationship">
        <div class="search-bar">
          <el-select
            v-model="person1Id"
            placeholder="选择第一个人"
            filterable
            remote
            :remote-method="searchPersons1"
            :loading="searchLoading"
            style="width: 250px"
          >
            <el-option
              v-for="item in person1Options"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              {{ item.name }} ({{ item.gender }})
            </el-option>
          </el-select>
          <span style="align-self: center; color: #909399">与</span>
          <el-select
            v-model="person2Id"
            placeholder="选择第二个人"
            filterable
            remote
            :remote-method="searchPersons2"
            :loading="searchLoading"
            style="width: 250px"
          >
            <el-option
              v-for="item in person2Options"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              {{ item.name }} ({{ item.gender }})
            </el-option>
          </el-select>
          <el-button type="primary" @click="queryRelationship" :disabled="!person1Id || !person2Id">
            查询关系
          </el-button>
        </div>

        <div v-if="relationshipResult">
          <el-alert
            :title="relationshipResult.description"
            type="success"
            show-icon
            style="margin-bottom: 20px"
          />
          
          <div v-if="relationshipResult.path && relationshipResult.path.length > 0">
            <h4 style="margin-bottom: 10px; color: #303133">关系路径：</h4>
            <div class="relationship-path">
              <template v-for="(personId, index) in relationshipResult.path" :key="personId">
                <div class="path-person">
                  <el-avatar :size="28" :src="relationshipResult.persons[personId]?.photo_url">
                    {{ relationshipResult.persons[personId]?.name?.charAt(0) }}
                  </el-avatar>
                  <span>{{ relationshipResult.persons[personId]?.name }}</span>
                </div>
                <el-icon v-if="index < relationshipResult.path.length - 1" class="path-arrow">
                  <ArrowRight />
                </el-icon>
              </template>
            </div>

            <el-table v-if="relationshipResult.pathDetails" :data="relationshipResult.pathDetails" border style="margin-top: 20px">
              <el-table-column label="起点" width="120">
                <template #default="{ row }">
                  {{ row.from?.name }}
                </template>
              </el-table-column>
              <el-table-column label="关系" width="100">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.relationship }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="终点">
                <template #default="{ row }">
                  {{ row.to?.name }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="后代查询" name="descendants">
        <div class="search-bar">
          <el-select
            v-model="descendantPersonId"
            placeholder="选择要查询的人员"
            filterable
            remote
            :remote-method="searchPersonsForDescendants"
            :loading="searchLoading"
            style="width: 250px"
          >
            <el-option
              v-for="item in descendantOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              {{ item.name }} ({{ item.gender }})
            </el-option>
          </el-select>
          <el-switch v-model="includeSelf" active-text="包含本人" style="margin-left: 10px" />
          <el-button type="primary" @click="queryDescendants" :disabled="!descendantPersonId">
            查询后代
          </el-button>
        </div>

        <div v-if="descendantResult">
          <el-alert
            :title="`共找到 ${descendantResult.total} 名后代（共 ${descendantResult.max_generation} 代）`"
            type="info"
            show-icon
            style="margin-bottom: 20px"
          />

          <div v-for="(genPersons, gen) in descendantResult.generations" :key="gen" style="margin-bottom: 20px">
            <h4 style="margin-bottom: 10px">
              <span class="generation-badge">第 {{ gen }} 代</span>
              <span style="color: #909399; margin-left: 10px; font-size: 14px">共 {{ genPersons.length }} 人</span>
            </h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap">
              <div v-for="person in genPersons" :key="person.id"
                   style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ecf5ff; border-radius: 8px">
                <el-avatar :size="28" :src="person.photo_url">
                  {{ person.name.charAt(0) }}
                </el-avatar>
                <div>
                  <div style="font-weight: bold">{{ person.name }}</div>
                  <div style="font-size: 12px; color: #909399">
                    {{ person.relationship_type }} · {{ person.birth_date || '未知' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="祖先查询" name="ancestors">
        <div class="search-bar">
          <el-select
            v-model="ancestorPersonId"
            placeholder="选择要查询的人员"
            filterable
            remote
            :remote-method="searchPersonsForAncestors"
            :loading="searchLoading"
            style="width: 250px"
          >
            <el-option
              v-for="item in ancestorOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              {{ item.name }} ({{ item.gender }})
            </el-option>
          </el-select>
          <el-switch v-model="includeSelfAncestor" active-text="包含本人" style="margin-left: 10px" />
          <el-button type="primary" @click="queryAncestors" :disabled="!ancestorPersonId">
            查询祖先
          </el-button>
        </div>

        <div v-if="ancestorResult">
          <el-alert
            :title="`共找到 ${ancestorResult.total} 名祖先（共 ${ancestorResult.max_generation} 代）`"
            type="info"
            show-icon
            style="margin-bottom: 20px"
          />

          <div v-for="(genPersons, gen) in ancestorResult.generations" :key="gen" style="margin-bottom: 20px">
            <h4 style="margin-bottom: 10px">
              <span class="generation-badge">上 {{ gen }} 代</span>
              <span style="color: #909399; margin-left: 10px; font-size: 14px">共 {{ genPersons.length }} 人</span>
            </h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap">
              <div v-for="person in genPersons" :key="person.id"
                   style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fef0f0; border-radius: 8px">
                <el-avatar :size="28" :src="person.photo_url">
                  {{ person.name.charAt(0) }}
                </el-avatar>
                <div>
                  <div style="font-weight: bold">{{ person.name }}</div>
                  <div style="font-size: 12px; color: #909399">
                    {{ person.relationship_type }} · {{ person.birth_date || '未知' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="世代统计" name="generation">
        <div style="margin-bottom: 20px">
          <el-button type="primary" @click="loadGenerationStats">刷新统计</el-button>
        </div>

        <div v-if="generationStats.length > 0">
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="chart-container" ref="genChartRef"></div>
            </el-col>
            <el-col :span="12">
              <el-table :data="generationStats" border>
                <el-table-column prop="generation" label="世代" width="100">
                  <template #default="{ row }">
                    <span class="generation-badge">第 {{ row.generation }} 代</span>
                  </template>
                </el-table-column>
                <el-table-column prop="count" label="人数" />
              </el-table>
            </el-col>
          </el-row>
        </div>

        <div style="margin-top: 30px">
          <h3 style="margin-bottom: 15px; color: #303133">最长传承链</h3>
          <el-button type="primary" @click="loadLongestChain" style="margin-bottom: 15px">查看最长传承链</el-button>
          
          <div v-if="longestChain">
            <el-alert
              :title="`最长传承链共 ${longestChain.length} 代`"
              type="success"
              show-icon
              style="margin-bottom: 15px"
            />
            <div class="relationship-path">
              <template v-for="(person, index) in longestChain.persons" :key="person.id">
                <div class="path-person">
                  <el-avatar :size="28" :src="person.photo_url">
                    {{ person.name.charAt(0) }}
                  </el-avatar>
                  <span>{{ person.name }}</span>
                </div>
                <el-icon v-if="index < longestChain.persons.length - 1" class="path-arrow">
                  <ArrowRight />
                </el-icon>
              </template>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="personDetailVisible" title="人员详情" width="600px">
      <div v-if="selectedPerson">
        <div class="detail-section">
          <h3 class="detail-section-title">基本信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">姓名</span>
              <span class="info-value">{{ selectedPerson.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">性别</span>
              <span class="info-value">{{ selectedPerson.gender }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">出生日期</span>
              <span class="info-value">{{ selectedPerson.birth_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">去世日期</span>
              <span class="info-value">{{ selectedPerson.death_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">籍贯</span>
              <span class="info-value">{{ selectedPerson.hometown || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">职业</span>
              <span class="info-value">{{ selectedPerson.occupation || '-' }}</span>
            </div>
          </div>
        </div>
        <div v-if="selectedPerson.bio" class="detail-section">
          <h3 class="detail-section-title">个人简介</h3>
          <p style="line-height: 1.8; color: #606266">{{ selectedPerson.bio }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import { personApi, queryApi } from '@/api';

const activeTab = ref('name');
const searchName = ref('');
const searchResults = ref([]);
const hasSearched = ref(false);
const searchLoading = ref(false);

const person1Id = ref(null);
const person2Id = ref(null);
const person1Options = ref([]);
const person2Options = ref([]);
const relationshipResult = ref(null);

const descendantPersonId = ref(null);
const descendantOptions = ref([]);
const includeSelf = ref(false);
const descendantResult = ref(null);

const ancestorPersonId = ref(null);
const ancestorOptions = ref([]);
const includeSelfAncestor = ref(false);
const ancestorResult = ref(null);

const generationStats = ref([]);
const longestChain = ref(null);
const genChartRef = ref(null);
let genChart = null;

const selectedPerson = ref(null);
const personDetailVisible = ref(false);

onMounted(() => {
  loadGenerationStats();
});

async function handleNameSearch() {
  if (!searchName.value.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }
  
  hasSearched.value = true;
  searchLoading.value = true;
  try {
    searchResults.value = await personApi.search(searchName.value.trim());
  } finally {
    searchLoading.value = false;
  }
}

async function searchPersons1(query) {
  if (!query) {
    person1Options.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    person1Options.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

async function searchPersons2(query) {
  if (!query) {
    person2Options.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    person2Options.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

async function queryRelationship() {
  try {
    relationshipResult.value = await queryApi.relationshipPath(person1Id.value, person2Id.value);
  } catch (err) {
    ElMessage.error('查询失败');
  }
}

async function searchPersonsForDescendants(query) {
  if (!query) {
    descendantOptions.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    descendantOptions.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

async function queryDescendants() {
  try {
    descendantResult.value = await queryApi.descendants(descendantPersonId.value, includeSelf.value);
  } catch (err) {
    ElMessage.error('查询失败');
  }
}

async function searchPersonsForAncestors(query) {
  if (!query) {
    ancestorOptions.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    ancestorOptions.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

async function queryAncestors() {
  try {
    ancestorResult.value = await queryApi.ancestors(ancestorPersonId.value, includeSelfAncestor.value);
  } catch (err) {
    ElMessage.error('查询失败');
  }
}

async function loadGenerationStats() {
  try {
    generationStats.value = await queryApi.generationStats();
    await nextTick();
    renderGenChart();
  } catch (err) {
    ElMessage.error('加载统计失败');
  }
}

async function loadLongestChain() {
  try {
    longestChain.value = await queryApi.longestChain();
  } catch (err) {
    ElMessage.error('加载失败');
  }
}

function renderGenChart() {
  if (!genChartRef.value) return;
  
  if (genChart) {
    genChart.dispose();
  }
  
  genChart = echarts.init(genChartRef.value);
  
  const option = {
    title: {
      text: '各代人数统计',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'category',
      data: generationStats.value.map(g => `第${g.generation}代`),
      axisLabel: { interval: 0 }
    },
    yAxis: {
      type: 'value',
      name: '人数'
    },
    series: [{
      type: 'bar',
      data: generationStats.value.map(g => g.count),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#667eea' },
          { offset: 1, color: '#764ba2' }
        ])
      },
      label: {
        show: true,
        position: 'top'
      }
    }]
  };
  
  genChart.setOption(option);
}

function viewPersonDetail(row) {
  selectedPerson.value = row;
  personDetailVisible.value = true;
}
</script>
