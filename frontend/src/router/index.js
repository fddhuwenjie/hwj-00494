import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/tree'
  },
  {
    path: '/tree',
    name: 'FamilyTree',
    component: () => import('@/views/FamilyTree.vue'),
    meta: { title: '族谱树' }
  },
  {
    path: '/persons',
    name: 'Persons',
    component: () => import('@/views/Persons.vue'),
    meta: { title: '人物管理' }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/views/Search.vue'),
    meta: { title: '搜索查询' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics.vue'),
    meta: { title: '统计分析' }
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('@/views/Export.vue'),
    meta: { title: '导入导出' }
  },
  {
    path: '/share/:token',
    name: 'ShareView',
    component: () => import('@/views/ShareView.vue'),
    meta: { title: '族谱分享' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 家族族谱系统` : '家族族谱系统';
  next();
});

export default router;
