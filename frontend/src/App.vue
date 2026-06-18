<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28" color="#fff"><HomeFilled /></el-icon>
          <span class="title">家族族谱系统</span>
        </div>
        <el-menu mode="horizontal" :default-active="activeMenu" class="nav-menu" @select="handleMenuSelect">
          <el-menu-item index="/tree">
            <el-icon><Share /></el-icon>
            <span>族谱树</span>
          </el-menu-item>
          <el-menu-item index="/persons">
            <el-icon><User /></el-icon>
            <span>人物管理</span>
          </el-menu-item>
          <el-menu-item index="/search">
            <el-icon><Search /></el-icon>
            <span>搜索查询</span>
          </el-menu-item>
          <el-menu-item index="/statistics">
            <el-icon><DataAnalysis /></el-icon>
            <span>统计分析</span>
          </el-menu-item>
          <el-menu-item index="/export">
            <el-icon><Download /></el-icon>
            <span>导入导出</span>
          </el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const activeMenu = computed(() => route.path);

function handleMenuSelect(index) {
  router.push(index);
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  height: 100%;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0;
  height: 60px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo .title {
  color: #fff;
  font-size: 20px;
  font-weight: bold;
}

.nav-menu {
  background: transparent;
  border-bottom: none;
}

.nav-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.9);
  height: 60px;
  line-height: 60px;
  border-bottom: none;
}

.nav-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-bottom: 3px solid #ffd700;
}

.app-main {
  padding: 20px;
  background: #f5f7fa;
  overflow: auto;
  height: calc(100vh - 60px);
}
</style>
