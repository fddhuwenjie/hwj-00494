<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">统计分析</h2>
      <el-button type="primary" @click="loadData" :loading="loading">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </el-button>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <div class="stats-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div class="label">总人数</div>
          <div class="value">{{ familyStats.total || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <div class="label">在世</div>
          <div class="value">{{ familyStats.alive || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <div class="label">已故</div>
          <div class="value">{{ familyStats.deceased || 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
          <div class="label">平均寿命（岁）</div>
          <div class="value">{{ familyStats.avg_lifespan ? familyStats.avg_lifespan.toFixed(1) : '-' }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="page-container" style="margin-bottom: 20px;">
          <h3 class="detail-section-title">各代人数统计</h3>
          <div ref="generationChart" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-container" style="margin-bottom: 20px;">
          <h3 class="detail-section-title">性别分布</h3>
          <div ref="genderChart" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="page-container" style="margin-bottom: 20px;">
          <h3 class="detail-section-title">姓氏分布（含嫁入）</h3>
          <div ref="surnameChart" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-container" style="margin-bottom: 20px;">
          <h3 class="detail-section-title">地域分布</h3>
          <div ref="regionChart" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>

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
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { queryApi } from '../api';

const loading = ref(false);
const familyStats = ref({});
const surnameDistribution = ref([]);
const regionDistribution = ref([]);
const generationStats = ref([]);
const timeline = ref([]);

const generationChart = ref(null);
const genderChart = ref(null);
const surnameChart = ref(null);
const regionChart = ref(null);

let generationChartInstance = null;
let genderChartInstance = null;
let surnameChartInstance = null;
let regionChartInstance = null;

const getEventType = (type) => {
  const types = {
    birth: 'success',
    death: 'info',
    marriage: 'warning',
    other: ''
  };
  return types[type] || '';
};

const getEventTypeName = (type) => {
  const names = {
    birth: '出生',
    death: '去世',
    marriage: '结婚',
    other: '其他'
  };
  return names[type] || '事件';
};

const loadData = async () => {
  loading.value = true;
  try {
    const [stats, timelineData] = await Promise.all([
      queryApi.familyStats(),
      queryApi.timeline()
    ]);
    
    familyStats.value = stats;
    surnameDistribution.value = stats.surname_distribution || [];
    regionDistribution.value = stats.region_distribution || [];
    generationStats.value = stats.generation_stats || [];
    timeline.value = timelineData;

    await nextTick();
    initCharts();
  } catch (error) {
    console.error('加载统计数据失败:', error);
    ElMessage.error('加载统计数据失败');
  } finally {
    loading.value = false;
  }
};

const initCharts = () => {
  if (generationChart.value) {
    if (!generationChartInstance) {
      generationChartInstance = echarts.init(generationChart.value);
    }
    generationChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: generationStats.value.map(g => `第${g.generation}代`),
        axisLabel: { interval: 0 }
      },
      yAxis: { type: 'value', name: '人数' },
      series: [{
        data: generationStats.value.map(g => g.count),
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

  if (genderChart.value) {
    if (!genderChartInstance) {
      genderChartInstance = echarts.init(genderChart.value);
    }
    genderChartInstance.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {c}人 ({d}%)' },
        data: [
          { value: familyStats.value.male || 0, name: '男', itemStyle: { color: '#409eff' } },
          { value: familyStats.value.female || 0, name: '女', itemStyle: { color: '#f56c6c' } }
        ]
      }]
    });
  }

  if (surnameChart.value) {
    if (!surnameChartInstance) {
      surnameChartInstance = echarts.init(surnameChart.value);
    }
    const surnameData = surnameDistribution.value.slice(0, 10);
    surnameChartInstance.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: surnameData.map(s => s.surname),
        axisLabel: { interval: 0 }
      },
      yAxis: { type: 'value', name: '人数' },
      series: [{
        data: surnameData.map(s => s.count),
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f093fb' },
            { offset: 1, color: '#f5576c' }
          ])
        },
        label: { show: true, position: 'top' }
      }]
    });
  }

  if (regionChart.value) {
    if (!regionChartInstance) {
      regionChartInstance = echarts.init(regionChart.value);
    }
    const regionData = regionDistribution.value.slice(0, 8);
    regionChartInstance.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: '5%' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: regionData.map(r => ({ value: r.count, name: r.region })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: { formatter: '{b}: {c}人 ({d}%)' }
      }]
    });
  }
};

const handleResize = () => {
  generationChartInstance?.resize();
  genderChartInstance?.resize();
  surnameChartInstance?.resize();
  regionChartInstance?.resize();
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});
</script>

<style scoped>
.stats-card {
  min-height: 100px;
}
</style>
