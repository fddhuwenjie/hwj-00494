<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">族谱树</h2>
      <div style="display: flex; gap: 10px">
        <el-button @click="refreshTree">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
        <el-button type="primary" @click="openAddChildDialog" v-if="selectedNode">
          <el-icon><Plus /></el-icon>
          <span>添加子女</span>
        </el-button>
        <el-button type="success" @click="openAddMarriageDialog" v-if="selectedNode">
          <el-icon><Link /></el-icon>
          <span>建立婚姻</span>
        </el-button>
      </div>
    </div>

    <div class="search-bar" style="margin-bottom: 10px">
      <el-select
        v-model="highlightPersonId"
        placeholder="搜索并定位成员"
        filterable
        remote
        :remote-method="searchPersons"
        :loading="searchLoading"
        style="width: 250px"
        @change="highlightPerson"
      >
        <el-option
          v-for="item in searchOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        >
          <span>{{ item.name }}</span>
          <span style="float: right; color: #8492a6; font-size: 13px">
            {{ item.gender }} · {{ item.birth_date || '未知' }}
          </span>
        </el-option>
      </el-select>
      <span style="color: #909399; font-size: 13px; align-self: center">
        提示：可使用鼠标滚轮缩放，拖拽平移画布，点击节点查看详情
      </span>
    </div>

    <div class="tree-container" ref="treeContainer" id="family-tree-container">
      <div class="tree-toolbar">
        <el-button-group>
          <el-button size="small" @click="zoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button size="small" @click="zoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
          <el-button size="small" @click="resetView">
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </el-button-group>
      </div>

      <svg ref="svgRef" :width="svgWidth" :height="svgHeight">
        <g :transform="transformString">
          <g class="links">
            <path
              v-for="(link, index) in treeLinks"
              :key="`link-${index}`"
              :d="link.path"
              fill="none"
              :stroke="link.type === 'marriage' ? '#f56c6c' : '#dcdfe6'"
              :stroke-width="link.type === 'marriage' ? 2 : 1.5"
              :stroke-dasharray="link.type === 'adoption' ? '5,5' : 'none'"
            />
          </g>
          <g class="nodes">
            <g
              v-for="node in treeNodes"
              :key="node.id"
              class="tree-node"
              :transform="`translate(${node.x}, ${node.y})`"
              @click="selectNode(node)"
              @mouseenter="showTooltip(node, $event)"
              @mouseleave="hideTooltip"
            >
              <foreignObject :x="-nodeWidth / 2" :y="-nodeHeight / 2" :width="nodeWidth" :height="nodeHeight">
                <div
                  :class="[
                    'node-card',
                    node.gender === '男' ? 'male' : 'female',
                    node.is_deceased ? 'deceased' : '',
                    node.id == selectedNode?.id ? 'selected' : '',
                    node.id == highlightPersonId ? 'highlighted' : ''
                  ]"
                  xmlns="http://www.w3.org/1999/xhtml"
                >
                  <div class="node-name">{{ node.name }}</div>
                  <div class="node-dates">
                    {{ formatDates(node.birth_date, node.death_date) }}
                  </div>
                  <div v-if="node.spouses && node.spouses.length > 0" class="spouse-indicator">
                    ♥ {{ node.spouses.length }}
                  </div>
                </div>
              </foreignObject>
            </g>
          </g>
        </g>
      </svg>

      <div
        v-if="tooltipVisible"
        class="tooltip-content"
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px', position: 'absolute', zIndex: 1000 }"
      >
        <div v-if="tooltipPerson">
          <div class="tooltip-item">
            <span class="tooltip-label">姓名：</span>
            <span class="tooltip-value">{{ tooltipPerson.name }}</span>
          </div>
          <div class="tooltip-item">
            <span class="tooltip-label">性别：</span>
            <span class="tooltip-value">{{ tooltipPerson.gender }}</span>
          </div>
          <div class="tooltip-item">
            <span class="tooltip-label">出生日期：</span>
            <span class="tooltip-value">{{ tooltipPerson.birth_date || '未知' }}</span>
          </div>
          <div class="tooltip-item" v-if="tooltipPerson.death_date">
            <span class="tooltip-label">去世日期：</span>
            <span class="tooltip-value">{{ tooltipPerson.death_date }}</span>
          </div>
          <div class="tooltip-item" v-if="tooltipPerson.hometown">
            <span class="tooltip-label">籍贯：</span>
            <span class="tooltip-value">{{ tooltipPerson.hometown }}</span>
          </div>
          <div class="tooltip-item" v-if="tooltipPerson.occupation">
            <span class="tooltip-label">职业：</span>
            <span class="tooltip-value">{{ tooltipPerson.occupation }}</span>
          </div>
          <div class="tooltip-item" v-if="tooltipPerson.bio">
            <span class="tooltip-label">简介：</span>
            <span class="tooltip-value">{{ tooltipPerson.bio }}</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="detailDialogVisible" title="成员详情" width="600px">
      <div v-if="selectedNode && personsMap[selectedNode.id]">
        <div class="detail-section">
          <h3 class="detail-section-title">基本信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">姓名</span>
              <span class="info-value">{{ selectedNode.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">性别</span>
              <span class="info-value">{{ selectedNode.gender }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">出生日期</span>
              <span class="info-value">{{ selectedNode.birth_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">去世日期</span>
              <span class="info-value">{{ selectedNode.death_date || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">籍贯</span>
              <span class="info-value">{{ selectedNode.hometown || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">职业</span>
              <span class="info-value">{{ selectedNode.occupation || '-' }}</span>
            </div>
          </div>
        </div>
        <div v-if="selectedNode.bio" class="detail-section">
          <h3 class="detail-section-title">个人简介</h3>
          <p style="line-height: 1.8; color: #606266">{{ selectedNode.bio }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="editPerson">编辑</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addChildDialogVisible" title="添加子女" width="500px">
      <el-form :model="childForm" :rules="childFormRules" ref="childFormRef" label-width="100px">
        <el-form-item label="父亲">
          <el-input :value="selectedNode?.gender === '男' ? selectedNode.name : fatherName" disabled />
        </el-form-item>
        <el-form-item label="母亲">
          <el-input :value="selectedNode?.gender === '女' ? selectedNode.name : motherName" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="childForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="childForm.gender">
            <el-radio label="男">男</el-radio>
            <el-radio label="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker
            v-model="childForm.birth_date"
            type="date"
            placeholder="选择出生日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="关系类型">
          <el-radio-group v-model="childForm.relationType">
            <el-radio label="natural">亲生</el-radio>
            <el-radio label="adopted">收养</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addChildDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddChild">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addMarriageDialogVisible" title="建立婚姻关系" width="500px">
      <el-form :model="marriageForm" :rules="marriageFormRules" ref="marriageFormRef" label-width="100px">
        <el-form-item label="配偶1" prop="person1">
          <el-input :value="selectedNode?.name" disabled />
        </el-form-item>
        <el-form-item label="配偶2" prop="spouseId">
          <el-select
            v-model="marriageForm.spouseId"
            placeholder="选择配偶"
            filterable
            remote
            :remote-method="searchPersonsForMarriage"
            :loading="searchLoading"
            style="width: 100%"
          >
            <el-option
              v-for="item in marriageSearchOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="item.id == selectedNode?.id || item.gender == selectedNode?.gender"
            >
              <span>{{ item.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 13px">
                {{ item.gender }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="结婚日期">
          <el-date-picker
            v-model="marriageForm.marriage_date"
            type="date"
            placeholder="选择结婚日期（可选）"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addMarriageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddMarriage">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as d3 from 'd3';
import { useFamilyStore } from '@/stores/family';
import { personApi, relationshipApi, queryApi } from '@/api';

const store = useFamilyStore();

const treeContainer = ref(null);
const svgRef = ref(null);
const svgWidth = ref(2000);
const svgHeight = ref(1500);
const nodeWidth = 140;
const nodeHeight = 70;

const transform = ref({ x: 0, y: 0, k: 1 });
const treeData = ref(null);
const treeNodes = ref([]);
const treeLinks = ref([]);
const personsMap = ref({});

const selectedNode = ref(null);
const highlightPersonId = ref(null);
const detailDialogVisible = ref(false);
const addChildDialogVisible = ref(false);
const addMarriageDialogVisible = ref(false);

const tooltipVisible = ref(false);
const tooltipPerson = ref(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

const searchLoading = ref(false);
const searchOptions = ref([]);
const marriageSearchOptions = ref([]);

const fatherName = ref('');
const motherName = ref('');

const childForm = reactive({
  name: '',
  gender: '男',
  birth_date: '',
  relationType: 'natural'
});

const childFormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }]
};

const childFormRef = ref(null);

const marriageForm = reactive({
  spouseId: null,
  marriage_date: ''
});

const marriageFormRules = {
  spouseId: [{ required: true, message: '请选择配偶', trigger: 'change' }]
};

const marriageFormRef = ref(null);

const transformString = computed(() => {
  return `translate(${transform.value.x}, ${transform.value.y}) scale(${transform.value.k})`;
});

onMounted(() => {
  initZoom();
  loadTreeData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

function handleResize() {
  if (treeContainer.value) {
    svgWidth.value = treeContainer.value.clientWidth * 2;
    svgHeight.value = treeContainer.value.clientHeight * 2;
  }
}

function initZoom() {
  const svg = d3.select(svgRef.value);
  const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on('zoom', (event) => {
      transform.value = event.transform;
    });
  
  svg.call(zoom);
  
  handleResize();
  resetView();
}

function zoomIn() {
  const svg = d3.select(svgRef.value);
  svg.transition().duration(300).call(d3.zoom().scaleBy, 1.2);
}

function zoomOut() {
  const svg = d3.select(svgRef.value);
  svg.transition().duration(300).call(d3.zoom().scaleBy, 0.8);
}

function resetView() {
  const svg = d3.select(svgRef.value);
  const containerWidth = treeContainer.value?.clientWidth || 1200;
  const containerHeight = treeContainer.value?.clientHeight || 800;
  
  const centerX = containerWidth / 2 - 600;
  const centerY = 50;
  
  svg.transition().duration(500).call(
    d3.zoom().transform,
    d3.zoomIdentity.translate(centerX, centerY).scale(0.8)
  );
}

async function loadTreeData() {
  try {
    const result = await store.loadTreeData();
    treeData.value = result;
    personsMap.value = result.persons || {};
    generateTreeLayout();
  } catch (err) {
    ElMessage.error('加载族谱树失败');
  }
}

function refreshTree() {
  loadTreeData();
}

function generateTreeLayout() {
  if (!treeData.value?.trees) return;
  
  const nodes = [];
  const links = [];
  
  const processedIds = new Set();
  
  function calculateGenerations() {
    const generations = {};
    const visited = new Set();
    
    function assignGeneration(nodeId, gen) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      if (!generations[gen]) generations[gen] = [];
      generations[gen].push(nodeId);
      
      const person = personsMap.value[nodeId];
      if (person) {
        person.children?.forEach(child => {
          assignGeneration(child.id, gen + 1);
        });
      }
    }
    
    treeData.value.trees.forEach(tree => {
      assignGeneration(tree.id, 1);
    });
    
    return generations;
  }
  
  const generations = calculateGenerations();
  
  const genPositions = {};
  Object.keys(generations).forEach(gen => {
    const genNum = parseInt(gen);
    const personsInGen = generations[gen];
    const totalWidth = personsInGen.length * (nodeWidth + 50);
    const startX = -totalWidth / 2 + nodeWidth / 2;
    
    personsInGen.forEach((personId, index) => {
      const x = startX + index * (nodeWidth + 50);
      const y = (genNum - 1) * (nodeHeight + 80) + 50;
      
      if (!processedIds.has(personId)) {
        const person = personsMap.value[personId];
        if (person) {
          nodes.push({
            id: personId,
            x: x,
            y: y,
            name: person.name,
            gender: person.gender,
            birth_date: person.birth_date,
            death_date: person.death_date,
            is_deceased: person.is_deceased,
            hometown: person.hometown,
            occupation: person.occupation,
            bio: person.bio,
            spouses: person.spouses,
            children: person.children
          });
          processedIds.add(personId);
        }
      }
    });
    genPositions[genNum] = { startX, persons: personsInGen };
  });
  
  const nodePositions = {};
  nodes.forEach(n => {
    nodePositions[n.id] = { x: n.x, y: n.y };
  });
  
  treeData.value.relationships?.forEach(rel => {
    if (rel.parent_id && rel.child_id && nodePositions[rel.parent_id] && nodePositions[rel.child_id]) {
      const parent = nodePositions[rel.parent_id];
      const child = nodePositions[rel.child_id];
      
      const midY = (parent.y + child.y) / 2;
      const path = `M ${parent.x} ${parent.y + nodeHeight / 2} 
                    V ${midY} 
                    H ${child.x} 
                    V ${child.y - nodeHeight / 2}`;
      
      links.push({
        path: path,
        type: rel.relationship_type.includes('收养') ? 'adoption' : 'parent-child'
      });
    }
  });
  
  treeData.value.marriages?.forEach(marriage => {
    if (nodePositions[marriage.husband_id] && nodePositions[marriage.wife_id]) {
      const husband = nodePositions[marriage.husband_id];
      const wife = nodePositions[marriage.wife_id];
      
      if (Math.abs(husband.y - wife.y) < 10) {
        const path = `M ${husband.x + nodeWidth / 2} ${husband.y} 
                      H ${wife.x - nodeWidth / 2}`;
        links.push({
          path: path,
          type: 'marriage'
        });
      }
    }
  });
  
  treeNodes.value = nodes;
  treeLinks.value = links;
}

function formatDates(birth, death) {
  if (birth && death) {
    return `${birth.substring(0, 4)} - ${death.substring(0, 4)}`;
  } else if (birth) {
    return `${birth.substring(0, 4)} - 至今`;
  }
  return '生卒年未知';
}

function selectNode(node) {
  selectedNode.value = node;
  detailDialogVisible.value = true;
  
  if (node.gender === '男') {
    fatherName.value = node.name;
    motherName.value = '请选择母亲';
  } else {
    motherName.value = node.name;
    fatherName.value = '请选择父亲';
  }
}

function showTooltip(node, event) {
  tooltipPerson.value = node;
  tooltipVisible.value = true;
  
  const rect = treeContainer.value.getBoundingClientRect();
  tooltipX.value = event.clientX - rect.left + 15;
  tooltipY.value = event.clientY - rect.top + 15;
}

function hideTooltip() {
  tooltipVisible.value = false;
  tooltipPerson.value = null;
}

async function searchPersons(query) {
  if (!query) {
    searchOptions.value = [];
    return;
  }
  
  searchLoading.value = true;
  try {
    searchOptions.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

async function searchPersonsForMarriage(query) {
  if (!query) {
    marriageSearchOptions.value = [];
    return;
  }
  
  searchLoading.value = true;
  try {
    marriageSearchOptions.value = await personApi.search(query);
  } finally {
    searchLoading.value = false;
  }
}

function highlightPerson(id) {
  const node = treeNodes.value.find(n => n.id == id);
  if (node) {
    const containerWidth = treeContainer.value?.clientWidth || 1200;
    const containerHeight = treeContainer.value?.clientHeight || 800;
    
    const targetX = containerWidth / 2 - node.x * 0.8;
    const targetY = containerHeight / 2 - node.y * 0.8;
    
    const svg = d3.select(svgRef.value);
    svg.transition().duration(800).call(
      d3.zoom().transform,
      d3.zoomIdentity.translate(targetX, targetY).scale(0.8)
    );
  }
}

function openAddChildDialog() {
  if (!selectedNode.value) return;
  
  childForm.name = '';
  childForm.gender = '男';
  childForm.birth_date = '';
  childForm.relationType = 'natural';
  
  addChildDialogVisible.value = true;
}

async function handleAddChild() {
  if (!childFormRef.value || !selectedNode.value) return;
  
  await childFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        let father_id, mother_id;
        
        if (selectedNode.value.gender === '男') {
          father_id = selectedNode.value.id;
          const motherPerson = await selectMother();
          if (!motherPerson) {
            ElMessage.warning('请先为孩子选择母亲');
            return;
          }
          mother_id = motherPerson.id;
        } else {
          mother_id = selectedNode.value.id;
          const fatherPerson = await selectFather();
          if (!fatherPerson) {
            ElMessage.warning('请先为孩子选择父亲');
            return;
          }
          father_id = fatherPerson.id;
        }
        
        const child_data = {
          name: childForm.name,
          gender: childForm.gender,
          birth_date: childForm.birth_date || null
        };
        
        await relationshipApi.addChild({
          father_id,
          mother_id,
          child_data
        });
        
        ElMessage.success('添加子女成功');
        addChildDialogVisible.value = false;
        loadTreeData();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '添加失败');
      }
    }
  });
}

function selectFather() {
  return new Promise((resolve) => {
    ElMessage.warning('请先完善选择父亲的功能');
    resolve(null);
  });
}

function selectMother() {
  return new Promise((resolve) => {
    ElMessage.warning('请先完善选择母亲的功能');
    resolve(null);
  });
}

function openAddMarriageDialog() {
  if (!selectedNode.value) return;
  marriageForm.spouseId = null;
  marriageForm.marriage_date = '';
  marriageSearchOptions.value = [];
  addMarriageDialogVisible.value = true;
}

async function handleAddMarriage() {
  if (!marriageFormRef.value || !selectedNode.value) return;
  
  await marriageFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        let husband_id, wife_id;
        
        if (selectedNode.value.gender === '男') {
          husband_id = selectedNode.value.id;
          wife_id = marriageForm.spouseId;
        } else {
          husband_id = marriageForm.spouseId;
          wife_id = selectedNode.value.id;
        }
        
        await relationshipApi.addMarriage({
          husband_id,
          wife_id,
          marriage_date: marriageForm.marriage_date || null
        });
        
        ElMessage.success('建立婚姻关系成功');
        addMarriageDialogVisible.value = false;
        loadTreeData();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    }
  });
}

function editPerson() {
  detailDialogVisible.value = false;
  ElMessage.info('请前往人物管理页面进行编辑');
}
</script>

<style scoped>
.node-card.selected {
  box-shadow: 0 0 0 3px #ffd700, 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  transform: scale(1.05);
}

.node-card.highlighted {
  box-shadow: 0 0 0 3px #409eff, 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.spouse-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, #f56c6c, #e74c3c);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.tooltip-content .tooltip-label {
  color: #909399;
}

.tooltip-content .tooltip-value {
  color: #fff;
}
</style>
