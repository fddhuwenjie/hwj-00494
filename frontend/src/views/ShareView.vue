<template>
  <div class="share-view">
    <div v-if="loading" class="loading-container">
      <el-icon class="loading-icon"><Loading /></el-icon>
      <p>正在加载家谱数据...</p>
    </div>

    <div v-else-if="!valid" class="error-container">
      <el-icon class="error-icon"><Warning /></el-icon>
      <h2>{{ errorMessage }}</h2>
      <p>该分享链接可能已过期或无效</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>

    <div v-else class="share-content">
      <div class="share-header">
        <div class="share-title">
          <h2>
            <el-icon><Share /></el-icon>
            {{ shareName }}
          </h2>
          <el-tag type="info" size="small">只读模式</el-tag>
        </div>
        <div class="share-stats">
          <el-tag type="success">总人数: {{ stats.total }}</el-tag>
          <el-tag type="primary">在世: {{ stats.alive }}</el-tag>
          <el-tag type="info">已故: {{ stats.deceased }}</el-tag>
        </div>
      </div>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="族谱树" name="tree">
          <div class="tree-container" ref="treeContainer">
            <div class="tree-toolbar">
              <el-button-group>
                <el-button size="small" @click="zoomIn">
                  <el-icon><ZoomIn /></el-icon>
                </el-button>
                <el-button size="small" @click="zoomOut">
                  <el-icon><ZoomOut /></el-icon>
                </el-button>
                <el-button size="small" @click="resetZoom">
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </el-button-group>
            </div>
            <svg ref="svgRef" :width="svgWidth" :height="svgHeight">
              <g :transform="`translate(${pan.x}, ${pan.y}) scale(${zoom.scale})`">
                <g class="links">
                  <line
                    v-for="link in links"
                    :key="`link-${link.source}-${link.target}-${link.type}`"
                    :x1="link.x1"
                    :y1="link.y1"
                    :x2="link.x2"
                    :y2="link.y2"
                    :stroke="link.type === 'marriage' ? '#e6a23c' : '#909399'"
                    :stroke-dasharray="link.type === 'adoption' ? '5,5' : 'none'"
                    stroke-width="2"
                  />
                </g>
                <g class="nodes">
                  <g
                    v-for="node in treeNodes"
                    :key="node.id"
                    :transform="`translate(${node.x}, ${node.y})`"
                    class="tree-node"
                    @mouseenter="showTooltip(node, $event)"
                    @mouseleave="hideTooltip"
                  >
                    <foreignObject :width="nodeWidth" :height="nodeHeight" x="-60" y="-40">
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        class="node-card"
                        :class="{ male: node.gender === '男', female: node.gender === '女', deceased: node.death_date }"
                      >
                        <div class="node-name">{{ node.name }}</div>
                        <div class="node-dates">
                          {{ formatDates(node) }}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                </g>
              </g>
            </svg>
          </div>

          <div
            v-show="tooltipVisible"
            class="node-tooltip"
            :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
          >
            <div class="tooltip-content">
              <div class="tooltip-item">
                <span class="tooltip-label">姓名：</span>
                <span class="tooltip-value">{{ tooltipData.name }}</span>
              </div>
              <div class="tooltip-item">
                <span class="tooltip-label">性别：</span>
                <span class="tooltip-value">
                  <el-tag :class="tooltipData.gender === '男' ? 'male-tag' : 'female-tag'" size="small">
                    {{ tooltipData.gender }}
                  </el-tag>
                </span>
              </div>
              <div class="tooltip-item">
                <span class="tooltip-label">出生日期：</span>
                <span class="tooltip-value">{{ tooltipData.birth_date || '未知' }}</span>
              </div>
              <div v-if="tooltipData.death_date" class="tooltip-item">
                <span class="tooltip-label">去世日期：</span>
                <span class="tooltip-value">{{ tooltipData.death_date }}</span>
              </div>
              <div v-if="tooltipData.native_place" class="tooltip-item">
                <span class="tooltip-label">籍贯：</span>
                <span class="tooltip-value">{{ tooltipData.native_place }}</span>
              </div>
              <div v-if="tooltipData.occupation" class="tooltip-item">
                <span class="tooltip-label">职业：</span>
                <span class="tooltip-value">{{ tooltipData.occupation }}</span>
              </div>
              <div v-if="tooltipData.bio" class="tooltip-item">
                <span class="tooltip-label">简介：</span>
                <span class="tooltip-value">{{ tooltipData.bio }}</span>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="人物列表" name="persons">
          <div class="page-container">
            <div class="search-bar">
              <el-input
                v-model="searchName"
                placeholder="搜索姓名"
                clearable
                style="width: 200px;"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>

            <el-table :data="filteredPersons" stripe>
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column label="姓名" width="120">
                <template #default="{ row }">
                  <div class="person-info">
                    <img
                      v-if="row.photo_url"
                      :src="row.photo_url"
                      class="person-avatar small"
                      @error="$event.target.style.display = 'none'"
                    />
                    <span>{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="性别" width="80">
                <template #default="{ row }">
                  <el-tag :class="row.gender === '男' ? 'male-tag' : 'female-tag'" size="small">
                    {{ row.gender }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :class="row.death_date ? 'deceased-tag' : 'alive-tag'" size="small">
                    {{ row.death_date ? '已故' : '在世' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="birth_date" label="出生日期" width="120" />
              <el-table-column prop="death_date" label="去世日期" width="120" />
              <el-table-column prop="native_place" label="籍贯" width="120" />
              <el-table-column prop="occupation" label="职业" width="120" />
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="统计信息" name="stats">
          <div class="page-container">
            <el-row :gutter="20" style="margin-bottom: 20px;">
              <el-col :span="6">
                <div class="stats-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                  <div class="label">总人数</div>
                  <div class="value">{{ stats.total || 0 }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stats-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                  <div class="label">在世</div>
                  <div class="value">{{ stats.alive || 0 }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stats-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                  <div class="label">已故</div>
                  <div class="value">{{ stats.deceased || 0 }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="stats-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                  <div class="label">平均寿命</div>
                  <div class="value">{{ stats.avg_lifespan ? stats.avg_lifespan.toFixed(1) : '-' }}</div>
                </div>
              </el-col>
            </el-row>

            <div class="page-container" style="margin-bottom: 20px;">
              <h3 class="detail-section-title">各代人数统计</h3>
              <div ref="genChart" class="chart-container"></div>
            </div>

            <div class="page-container">
              <h3 class="detail-section-title">家族事件时间轴</h3>
              <div class="timeline-container" v-if="timeline.length > 0">
                <div v-for="(item, index) in timeline" :key="index" class="timeline-item">
                  <div class="timeline-year">{{ item.year }}年</div>
                  <div v-for="(event, eIndex) in item.events" :key="eIndex" class="timeline-event">
                    <el-tag :type="getEventType(event.type)" size="small" style="margin-right: 10px;">
                      {{ getEventTypeName(event.type) }}
                    </el-tag>
                    {{ event.description }}
                  </div>
                </div>
              </div>
              <el-empty v-else description="暂无事件数据" />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { shareApi, queryApi } from '../api';
import {
  Loading, Warning, Share, ZoomIn, ZoomOut, Refresh, Search
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const valid = ref(false);
const errorMessage = ref('');
const shareName = ref('');
const activeTab = ref('tree');

const persons = ref([]);
const treeNodes = ref([]);
const links = ref([]);
const stats = ref({});
const timeline = ref([]);
const searchName = ref('');

const treeContainer = ref(null);
const svgRef = ref(null);
const genChart = ref(null);

const svgWidth = ref(2000);
const svgHeight = ref(1000);
const nodeWidth = 120;
const nodeHeight = 80;

const zoom = reactive({ scale: 1 });
const pan = reactive({ x: 50, y: 50 });

const tooltipVisible = ref(false);
const tooltipData = ref({});
const tooltipPosition = reactive({ x: 0, y: 0 });

let genChartInstance = null;

const filteredPersons = computed(() => {
  if (!searchName.value) return persons.value;
  return persons.value.filter(p => 
    p.name.includes(searchName.value)
  );
});

const loadShareData = async () => {
  const token = route.params.token;
  if (!token) {
    valid.value = false;
    errorMessage.value = '缺少访问令牌';
    loading.value = false;
    return;
  }

  try {
    await shareApi.validate(token);
    
    const [allPersons, treeData, familyStats, timelineData] = await Promise.all([
      queryApi.familyStats().then(s => s.persons || []),
      queryApi.treeData(),
      queryApi.familyStats(),
      queryApi.timeline()
    ]);

    persons.value = allPersons;
    stats.value = familyStats;
    timeline.value = timelineData;

    generateTreeLayout(treeData.nodes, treeData.relationships);
    valid.value = true;
    shareName.value = '家族族谱';

    await nextTick();
    initChart();
  } catch (error) {
    console.error('加载分享数据失败:', error);
    valid.value = false;
    errorMessage.value = error.response?.data?.error || '链接无效或已过期';
  } finally {
    loading.value = false;
  }
};

const generateTreeLayout = (nodes, relationships) => {
  const personMap = new Map(nodes.map(p => [p.id, { ...p, children: [], parents: [], spouses: [], generation: 0 }]));

  relationships.forEach(rel => {
    if (rel.type === 'parent_child') {
      const parent = personMap.get(rel.from_id);
      const child = personMap.get(rel.to_id);
      if (parent && child) {
        parent.children.push(child);
        child.parents.push(parent);
      }
    } else if (rel.type === 'marriage') {
      const p1 = personMap.get(rel.from_id);
      const p2 = personMap.get(rel.to_id);
      if (p1 && p2) {
        p1.spouses.push(p2);
        p2.spouses.push(p1);
      }
    }
  });

  const visited = new Set();
  const assignGeneration = (person, gen) => {
    if (visited.has(person.id)) return;
    visited.add(person.id);
    person.generation = gen;
    person.children.forEach(child => assignGeneration(child, gen + 1));
  };

  const roots = nodes.filter(p => p.parents && p.parents.length === 0);
  roots.forEach(root => assignGeneration(root, 1));

  const generationMap = new Map();
  personMap.forEach(person => {
    if (!generationMap.has(person.generation)) {
      generationMap.set(person.generation, []);
    }
    generationMap.get(person.generation).push(person);
  });

  const sortedGenerations = Array.from(generationMap.keys()).sort((a, b) => a - b);
  const maxGen = sortedGenerations.length;
  const maxCount = Math.max(...Array.from(generationMap.values()).map(g => g.length));

  svgWidth.value = Math.max(2000, maxCount * (nodeWidth + 50) + 200);
  svgHeight.value = Math.max(1000, maxGen * (nodeHeight + 80) + 100);

  const resultNodes = [];
  const resultLinks = [];

  sortedGenerations.forEach((genNum, genIndex) => {
    const genPersons = generationMap.get(genNum);
    const genWidth = genPersons.length * (nodeWidth + 50) - 50;
    const startX = (svgWidth.value - genWidth) / 2;
    const y = (genNum - 1) * (nodeHeight + 80) + 50;

    genPersons.forEach((person, index) => {
      const x = startX + index * (nodeWidth + 50) + nodeWidth / 2;
      const node = {
        ...person,
        x,
        y
      };
      resultNodes.push(node);

      person.parents.forEach(parent => {
        const parentNode = resultNodes.find(n => n.id === parent.id);
        if (parentNode) {
          resultLinks.push({
            source: parent.id,
            target: person.id,
            type: 'parent_child',
            x1: parentNode.x,
            y1: parentNode.y + nodeHeight / 2,
            x2: x,
            y2: y - nodeHeight / 2
          });
        }
      });

      person.spouses.forEach(spouse => {
        if (person.id < spouse.id) {
          const spouseNode = resultNodes.find(n => n.id === spouse.id);
          if (spouseNode) {
            resultLinks.push({
              source: person.id,
              target: spouse.id,
              type: 'marriage',
              x1: x + nodeWidth / 2,
              y1: y,
              x2: spouseNode.x - nodeWidth / 2,
              y2: spouseNode.y
            });
          }
        }
      });
    });
  });

  treeNodes.value = resultNodes;
  links.value = resultLinks;
};

const showTooltip = (node, event) => {
  tooltipData.value = node;
  tooltipPosition.x = event.pageX + 15;
  tooltipPosition.y = event.pageY + 15;
  tooltipVisible.value = true;
};

const hideTooltip = () => {
  tooltipVisible.value = false;
};

const formatDates = (node) => {
  const birth = node.birth_date ? node.birth_date.slice(0, 4) : '?';
  const death = node.death_date ? node.death_date.slice(0, 4) : '';
  return death ? `${birth} - ${death}` : `${birth} - 今`;
};

const zoomIn = () => {
  zoom.scale = Math.min(3, zoom.scale + 0.1);
};

const zoomOut = () => {
  zoom.scale = Math.max(0.1, zoom.scale - 0.1);
};

const resetZoom = () => {
  zoom.scale = 1;
  pan.x = 50;
  pan.y = 50;
};

const initChart = () => {
  if (genChart.value && stats.value.generation_stats) {
    if (!genChartInstance) {
      genChartInstance = echarts.init(genChart.value);
    }
    genChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: stats.value.generation_stats.map(g => `第${g.generation}代`),
        axisLabel: { interval: 0 }
      },
      yAxis: { type: 'value', name: '人数' },
      series: [{
        data: stats.value.generation_stats.map(g => g.count),
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' }
          ])
        },
        label: { show: true, position: 'top' }
      }]
    });
  }
};

const getEventType = (type) => {
  const types = { birth: 'success', death: 'info', marriage: 'warning', other: '' };
  return types[type] || '';
};

const getEventTypeName = (type) => {
  const names = { birth: '出生', death: '去世', marriage: '结婚', other: '其他' };
  return names[type] || '事件';
};

const goHome = () => {
  router.push('/');
};

onMounted(() => {
  loadShareData();
});
</script>

<style scoped>
.share-view {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 20px;
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.loading-icon {
  font-size: 48px;
  color: #409eff;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.error-icon {
  font-size: 64px;
  color: #f56c6c;
  margin-bottom: 20px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.share-header {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.share-title {
  display: flex;
  align-items: center;
  gap: 15px;
}

.share-title h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tree-container {
  width: 100%;
  height: calc(100vh - 280px);
  overflow: auto;
  background: #fafafa;
  border-radius: 8px;
  position: relative;
}

.tree-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 100;
}

.tree-node {
  cursor: pointer;
}

.node-tooltip {
  position: fixed;
  z-index: 1000;
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

.person-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
