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
            <el-button size="small" type="warning" link @click="openRevisionDialog('person', row)">
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
              <h3 class="detail-section-title">父母（点击卡片查看关系详情）</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div
                  v-for="parent in currentPerson.parents"
                  :key="'p-' + parent.relationship_id"
                  class="clickable-card parent-card"
                  @click="openRelationshipDetail(parent, currentPerson.id)"
                >
                  <el-avatar :size="32" :src="parent.photo_url">
                    {{ parent.name.charAt(0) }}
                  </el-avatar>
                  <div>
                    <div style="font-weight: bold">{{ parent.name }}</div>
                    <div style="font-size: 12px; color: #909399">{{ parent.relationship_type }}</div>
                  </div>
                  <el-icon class="card-arrow"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.marriages && currentPerson.marriages.length > 0" class="detail-section">
              <h3 class="detail-section-title">配偶（点击卡片查看婚姻详情）</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div
                  v-for="spouse in currentPerson.marriages"
                  :key="'m-' + spouse.id"
                  class="clickable-card spouse-card"
                  @click="openMarriageDetail(spouse)"
                >
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
                  <el-icon class="card-arrow"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>

            <div v-if="currentPerson.children && currentPerson.children.length > 0" class="detail-section">
              <h3 class="detail-section-title">子女（点击卡片查看关系详情）</h3>
              <div style="display: flex; gap: 15px; flex-wrap: wrap">
                <div
                  v-for="child in currentPerson.children"
                  :key="'c-' + child.relationship_id"
                  class="clickable-card child-card"
                  @click="openRelationshipDetail(child, currentPerson.id, true)"
                >
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
                  <el-icon class="card-arrow"><ArrowRight /></el-icon>
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

          <el-tab-pane label="纪念日" name="anniversaries">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
                <h3 class="detail-section-title" style="margin-bottom: 0">家族纪念日</h3>
                <el-button type="primary" size="small" @click="openAnniversaryDialog()">
                  <el-icon><Plus /></el-icon> 新增纪念日
                </el-button>
              </div>
              <div v-if="detailContext.anniversaries.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Calendar /></el-icon>
                <p>暂无纪念日记录，点击上方按钮添加</p>
              </div>
              <el-table v-else :data="detailContext.anniversaries" border stripe>
                <el-table-column prop="event_type" label="类型" width="120">
                  <template #default="{ row }">
                    <el-tag :type="getEventTypeTag(row.event_type)" size="small">
                      {{ row.event_type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="event_date" label="日期" width="120" />
                <el-table-column label="今年日期" width="120">
                  <template #default="{ row }">{{ row.this_year_date }}</template>
                </el-table-column>
                <el-table-column label="距今天数" width="100">
                  <template #default="{ row }">
                    <el-tag :type="row.days_until_next === 0 ? 'danger' : row.days_until_next <= 7 ? 'warning' : 'info'" size="small">
                      {{ row.days_until_next === 0 ? '今天' : row.days_until_next + '天' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="is_lunar" label="历法" width="80">
                  <template #default="{ row }">{{ row.is_lunar ? '农历' : '公历' }}</template>
                </el-table-column>
                <el-table-column prop="notes" label="备注" />
                <el-table-column label="操作" width="150">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" link @click="openAnniversaryDialog(row)">
                      编辑
                    </el-button>
                    <el-button size="small" type="danger" link @click="deleteAnniversary(row)">
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="考证证据" name="evidence">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
                <h3 class="detail-section-title" style="margin-bottom: 0">证据资料</h3>
                <el-button type="primary" size="small" @click="openEvidenceDialog('person', currentPerson.id)">
                  <el-icon><Plus /></el-icon> 上传证据
                </el-button>
              </div>
              <div v-if="detailContext.evidence.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Document /></el-icon>
                <p>暂无证据资料，点击上方按钮添加</p>
              </div>
              <el-table v-else :data="detailContext.evidence" border stripe>
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
                    <el-button size="small" type="danger" link @click="deleteEvidence(row, 'person', currentPerson.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="历史版本" name="history">
            <div class="detail-section">
              <h3 class="detail-section-title">变更历史</h3>
              <div v-if="detailContext.changeLogs.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Clock /></el-icon>
                <p>暂无变更记录</p>
              </div>
              <el-timeline v-else>
                <el-timeline-item
                  v-for="log in detailContext.changeLogs"
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
                      <pre class="json-box before">{{ JSON.stringify(log.before_data, null, 2) }}</pre>
                    </div>
                    <div v-if="log.after_data">
                      <div style="color: #67c23a; font-size: 13px">变更后：</div>
                      <pre class="json-box after">{{ JSON.stringify(log.after_data, null, 2) }}</pre>
                    </div>
                    <div style="margin-top: 10px">
                      <el-button size="small" type="warning" @click="handleRollback(log, 'person', currentPerson)" v-if="log.action !== 'rollback'">
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

    <el-dialog v-model="marriageDetailVisible" title="婚姻详情" width="900px">
      <div v-if="currentMarriage">
        <div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center">
          <div style="display: flex; align-items: center; gap: 10px">
            <el-avatar :size="50" :src="currentMarriage.husband_photo">
              {{ currentMarriage.husband_name?.charAt(0) }}
            </el-avatar>
            <el-icon style="font-size: 24px; color: #f56c6c"><Male /></el-icon>
            <span style="font-weight: bold; font-size: 16px">{{ currentMarriage.husband_name || '丈夫' }}</span>
          </div>
          <el-icon style="font-size: 32px; color: #f56c6c"><Connection /></el-icon>
          <div style="display: flex; align-items: center; gap: 10px">
            <el-icon style="font-size: 24px; color: #e6a23c"><Female /></el-icon>
            <span style="font-weight: bold; font-size: 16px">{{ currentMarriage.wife_name || '妻子' }}</span>
            <el-avatar :size="50" :src="currentMarriage.wife_photo">
              {{ currentMarriage.wife_name?.charAt(0) }}
            </el-avatar>
          </div>
        </div>
        <el-descriptions :column="2" border style="margin-bottom: 15px">
          <el-descriptions-item label="婚姻ID">{{ currentMarriage.id }}</el-descriptions-item>
          <el-descriptions-item label="婚姻顺序">第{{ currentMarriage.marriage_order }}段</el-descriptions-item>
          <el-descriptions-item label="结婚日期">{{ currentMarriage.marriage_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="离婚日期">{{ currentMarriage.divorce_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentMarriage.is_active ? 'success' : 'info'">
              {{ currentMarriage.is_active ? '有效婚姻' : '已解除' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin-bottom: 10px">
          <el-button type="warning" size="small" @click="openRevisionDialog('marriage', currentMarriage)">
            <el-icon><Edit /></el-icon> 申请修订此婚姻
          </el-button>
        </div>
        <el-tabs v-model="marriageDetailTab" type="border-card">
          <el-tab-pane label="考证证据" name="evidence">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
                <h3 class="detail-section-title" style="margin-bottom: 0">婚姻证据资料</h3>
                <el-button type="primary" size="small" @click="openEvidenceDialog('marriage', currentMarriage.id)">
                  <el-icon><Plus /></el-icon> 上传证据
                </el-button>
              </div>
              <div v-if="marriageContext.evidence.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Document /></el-icon>
                <p>暂无婚姻证据资料</p>
              </div>
              <el-table v-else :data="marriageContext.evidence" border stripe>
                <el-table-column prop="evidence_type" label="资料类型" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" type="danger">{{ row.evidence_type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="source_title" label="来源标题" />
                <el-table-column prop="credibility" label="可信度" width="120">
                  <template #default="{ row }">
                    <el-rate v-model="row.credibility" disabled size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" link v-if="row.source_url" @click="window.open(row.source_url)">查看</el-button>
                    <el-button size="small" type="danger" link @click="deleteEvidence(row, 'marriage', currentMarriage.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="历史版本" name="history">
            <div class="detail-section">
              <h3 class="detail-section-title">婚姻变更历史</h3>
              <div v-if="marriageContext.changeLogs.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Clock /></el-icon>
                <p>暂无变更记录</p>
              </div>
              <el-timeline v-else>
                <el-timeline-item
                  v-for="log in marriageContext.changeLogs"
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
                      <span v-if="log.notes" style="margin-left: 10px">{{ log.notes }}</span>
                    </div>
                    <div v-if="log.before_data"><div style="color: #f56c6c; font-size: 13px">变更前：</div><pre class="json-box before">{{ JSON.stringify(log.before_data, null, 2) }}</pre></div>
                    <div v-if="log.after_data"><div style="color: #67c23a; font-size: 13px">变更后：</div><pre class="json-box after">{{ JSON.stringify(log.after_data, null, 2) }}</pre></div>
                    <div style="margin-top: 10px">
                      <el-button size="small" type="warning" @click="handleRollback(log, 'marriage', currentMarriage)" v-if="log.action !== 'rollback'">
                        <el-icon><RefreshLeft /></el-icon> 回滚
                      </el-button>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer><el-button @click="marriageDetailVisible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog v-model="relationshipDetailVisible" title="亲子关系详情" width="900px">
      <div v-if="currentRelationship">
        <el-descriptions :column="2" border style="margin-bottom: 15px">
          <el-descriptions-item label="关系ID">{{ currentRelationship.id }}</el-descriptions-item>
          <el-descriptions-item label="关系类型">
            <el-tag type="primary">{{ currentRelationship.relationship_type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="父/母">{{ currentRelationship.parent_name }} ({{ currentRelationship.parent_gender }})</el-descriptions-item>
          <el-descriptions-item label="子女">{{ currentRelationship.child_name }} ({{ currentRelationship.child_gender }})</el-descriptions-item>
        </el-descriptions>
        <div style="margin-bottom: 10px">
          <el-button type="warning" size="small" @click="openRevisionDialog('relationship', currentRelationship)">
            <el-icon><Edit /></el-icon> 申请修订此关系
          </el-button>
        </div>
        <el-tabs v-model="relationshipDetailTab" type="border-card">
          <el-tab-pane label="考证证据" name="evidence">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
                <h3 class="detail-section-title" style="margin-bottom: 0">亲子关系证据资料</h3>
                <el-button type="primary" size="small" @click="openEvidenceDialog('relationship', currentRelationship.id)">
                  <el-icon><Plus /></el-icon> 上传证据
                </el-button>
              </div>
              <div v-if="relationshipContext.evidence.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Document /></el-icon>
                <p>暂无亲子关系证据资料</p>
              </div>
              <el-table v-else :data="relationshipContext.evidence" border stripe>
                <el-table-column prop="evidence_type" label="资料类型" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" type="primary">{{ row.evidence_type }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="source_title" label="来源标题" />
                <el-table-column prop="credibility" label="可信度" width="120">
                  <template #default="{ row }">
                    <el-rate v-model="row.credibility" disabled size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" link v-if="row.source_url" @click="window.open(row.source_url)">查看</el-button>
                    <el-button size="small" type="danger" link @click="deleteEvidence(row, 'relationship', currentRelationship.id)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="历史版本" name="history">
            <div class="detail-section">
              <h3 class="detail-section-title">亲子关系变更历史</h3>
              <div v-if="relationshipContext.changeLogs.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Clock /></el-icon>
                <p>暂无变更记录</p>
              </div>
              <el-timeline v-else>
                <el-timeline-item
                  v-for="log in relationshipContext.changeLogs"
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
                      <span v-if="log.notes" style="margin-left: 10px">{{ log.notes }}</span>
                    </div>
                    <div v-if="log.before_data"><div style="color: #f56c6c; font-size: 13px">变更前：</div><pre class="json-box before">{{ JSON.stringify(log.before_data, null, 2) }}</pre></div>
                    <div v-if="log.after_data"><div style="color: #67c23a; font-size: 13px">变更后：</div><pre class="json-box after">{{ JSON.stringify(log.after_data, null, 2) }}</pre></div>
                    <div style="margin-top: 10px">
                      <el-button size="small" type="warning" @click="handleRollback(log, 'relationship', currentRelationship)" v-if="log.action !== 'rollback'">
                        <el-icon><RefreshLeft /></el-icon> 回滚
                      </el-button>
                    </div>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer><el-button @click="relationshipDetailVisible = false">关闭</el-button></template>
    </el-dialog>

    <el-dialog v-model="evidenceDialogVisible" :title="`上传证据 - ${evidenceTargetLabel}`" width="500px" @close="resetEvidenceForm">
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

    <el-dialog v-model="revisionDialogVisible" :title="`申请修订 - ${revisionTargetLabel}`" width="700px" @close="resetRevisionForm">
      <el-form :model="revisionForm" :rules="revisionRules" ref="revisionFormRef" label-width="100px">
        <div style="background: #ecf5ff; padding: 15px; border-radius: 8px; margin-bottom: 15px">
          <div style="font-weight: bold; margin-bottom: 10px">变更内容</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px">
            <div>
              <div style="color: #909399; font-size: 12px; margin-bottom: 5px">变更前（只读）</div>
              <pre class="json-box before">{{ JSON.stringify(revisionForm.before_data, null, 2) }}</pre>
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

    <el-dialog
      v-model="anniversaryDialogVisible"
      :title="isAnniversaryEdit ? '编辑纪念日' : '新增纪念日'"
      width="550px"
      @close="resetAnniversaryForm"
    >
      <el-form :model="anniversaryForm" :rules="anniversaryRules" ref="anniversaryFormRef" label-width="100px">
        <el-form-item label="事件类型" prop="event_type">
          <el-select v-model="anniversaryForm.event_type" placeholder="请选择事件类型" style="width: 100%">
            <el-option label="生日" value="生日" />
            <el-option label="忌日" value="忌日" />
            <el-option label="结婚纪念日" value="结婚纪念日" />
            <el-option label="迁居纪念" value="迁居纪念" />
            <el-option label="家族大事" value="家族大事" />
          </el-select>
        </el-form-item>
        <el-form-item label="事件日期" prop="event_date">
          <el-date-picker
            v-model="anniversaryForm.event_date"
            type="date"
            placeholder="选择事件日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="历法">
          <el-radio-group v-model="anniversaryForm.is_lunar">
            <el-radio :value="0">公历</el-radio>
            <el-radio :value="1">农历</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="重复规则">
          <el-select v-model="anniversaryForm.repeat_rule" style="width: 100%">
            <el-option label="每年" value="yearly" />
            <el-option label="不重复" value="none" />
          </el-select>
        </el-form-item>
        <el-form-item label="提醒提前">
          <el-input-number v-model="anniversaryForm.reminder_days" :min="0" :max="30" style="width: 100%" />
          <span style="font-size: 12px; color: #909399">提前几天提醒（0-30天）</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="anniversaryForm.notes"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="anniversaryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAnniversarySubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  RefreshLeft, Search, Plus, Edit, Document, Clock, ArrowRight,
  Male, Female, Connection
} from '@element-plus/icons-vue';
import { useFamilyStore } from '@/stores/family';
import { evidenceApi, revisionApi, personApi, anniversaryApi } from '@/api';

const store = useFamilyStore();
const loading = ref(false);
const searchName = ref('');
const searchGender = ref('');
const tableData = ref([]);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const marriageDetailVisible = ref(false);
const relationshipDetailVisible = ref(false);
const evidenceDialogVisible = ref(false);
const revisionDialogVisible = ref(false);
const isEdit = ref(false);
const currentPerson = ref(null);
const currentMarriage = ref(null);
const currentRelationship = ref(null);
const formRef = ref(null);
const evidenceFormRef = ref(null);
const revisionFormRef = ref(null);
const detailTab = ref('basic');
const marriageDetailTab = ref('evidence');
const relationshipDetailTab = ref('evidence');
const conflictResult = reactive({ checked: false, conflicts: [] });
const revisionAfterJson = ref('');
const evidenceTarget = reactive({ type: 'person', id: null });
const revisionTarget = reactive({ type: 'person', data: null });

const detailContext = reactive({ evidence: [], changeLogs: [], anniversaries: [] });
const marriageContext = reactive({ evidence: [], changeLogs: [] });
const relationshipContext = reactive({ evidence: [], changeLogs: [] });

const anniversaryDialogVisible = ref(false);
const anniversaryFormRef = ref(null);
const isAnniversaryEdit = ref(false);
const currentAnniversaryId = ref(null);

const anniversaryForm = reactive({
  person_id: null,
  event_type: '',
  event_date: '',
  is_lunar: 0,
  repeat_rule: 'yearly',
  reminder_days: 7,
  notes: ''
});

const anniversaryRules = {
  event_type: [{ required: true, message: '请选择事件类型', trigger: 'change' }],
  event_date: [{ required: true, message: '请选择事件日期', trigger: 'change' }]
};

const evidenceTargetLabel = computed(() => {
  const labels = { person: '人物', marriage: '婚姻', relationship: '亲子关系' };
  return labels[evidenceTarget.type] || '';
});
const revisionTargetLabel = computed(() => {
  const labels = { person: '人物', marriage: '婚姻', relationship: '亲子关系' };
  return labels[revisionTarget.type] || '';
});

const pagination = reactive({ page: 1, pageSize: 20, total: 0 });

const formData = reactive({
  name: '', gender: '男', birth_date: '', death_date: '',
  photo_url: '', hometown: '', occupation: '', bio: ''
});

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }]
};

const evidenceForm = reactive({
  evidence_type: '', source_title: '', source_url: '',
  photo_date: '', credibility: 3, notes: ''
});

const evidenceRules = {
  evidence_type: [{ required: true, message: '请选择资料类型', trigger: 'change' }],
  source_title: [{ required: true, message: '请输入来源标题', trigger: 'blur' }]
};

const revisionForm = reactive({
  target_type: 'person', target_id: null, action: 'update',
  before_data: {}, after_data: {}, reason: '', submitter: '普通成员'
});

const revisionRules = {
  reason: [{ required: true, message: '请输入申请理由', trigger: 'blur' }]
};

onMounted(() => { loadData(); });

async function loadData() {
  loading.value = true;
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize };
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
function handleSearch() { pagination.page = 1; loadData(); }
function resetSearch() { searchName.value = ''; searchGender.value = ''; pagination.page = 1; loadData(); }
function handleSizeChange(size) { pagination.pageSize = size; pagination.page = 1; loadData(); }
function handlePageChange(page) { pagination.page = page; loadData(); }
function openAddDialog() { isEdit.value = false; resetForm(); dialogVisible.value = true; }
function openEditDialog(row) { isEdit.value = true; Object.assign(formData, row); dialogVisible.value = true; }
function resetForm() {
  formData.name = ''; formData.gender = '男'; formData.birth_date = ''; formData.death_date = '';
  formData.photo_url = ''; formData.hometown = ''; formData.occupation = ''; formData.bio = '';
  if (formRef.value) formRef.value.resetFields();
}
async function handleSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) { await store.updatePerson(formData.id, formData); ElMessage.success('更新成功'); }
        else { await store.createPerson(formData); ElMessage.success('添加成功'); }
        dialogVisible.value = false; loadData();
      } catch (err) { ElMessage.error(err.response?.data?.error || '操作失败'); }
    }
  });
}
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除成员"${row.name}"吗？`, '删除确认', { type: 'warning' });
    await store.deletePerson(row.id);
    ElMessage.success('删除成功'); loadData();
  } catch (err) { if (err !== 'cancel') ElMessage.error(err.response?.data?.error || '删除失败'); }
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

async function loadContextAnniversaries(personId, ctx) {
  try {
    const result = await anniversaryApi.byPerson(personId);
    ctx.anniversaries = result.data || [];
  } catch (err) { ctx.anniversaries = []; }
}

async function viewDetail(row) {
  try {
    currentPerson.value = await store.loadPersonDetail(row.id);
    detailTab.value = 'basic';
    detailVisible.value = true;
    await loadContextEvidence('person', row.id, detailContext);
    await loadContextChangeLogs('person', row.id, detailContext);
    await loadContextAnniversaries(row.id, detailContext);
  } catch (err) { ElMessage.error('加载详情失败'); }
}

async function openMarriageDetail(spouseData) {
  try {
    const marriage = {
      id: spouseData.id,
      husband_id: spouseData.husband_id || spouseData.spouse_id,
      wife_id: spouseData.wife_id || (currentPerson.value?.gender === '女' ? currentPerson.value.id : spouseData.spouse_id),
      husband_name: spouseData.spouse_gender === '男' ? spouseData.spouse_name : currentPerson.value?.name,
      wife_name: spouseData.spouse_gender === '女' ? spouseData.spouse_name : currentPerson.value?.name,
      husband_gender: '男', wife_gender: '女',
      husband_photo: spouseData.spouse_gender === '男' ? spouseData.photo_url : currentPerson.value?.photo_url,
      wife_photo: spouseData.spouse_gender === '女' ? spouseData.photo_url : currentPerson.value?.photo_url,
      marriage_order: spouseData.marriage_order || 1,
      marriage_date: spouseData.marriage_date || null,
      divorce_date: spouseData.divorce_date || null,
      is_active: spouseData.is_active !== undefined ? spouseData.is_active : 1
    };
    currentMarriage.value = marriage;
    marriageDetailTab.value = 'evidence';
    marriageDetailVisible.value = true;
    await loadContextEvidence('marriage', marriage.id, marriageContext);
    await loadContextChangeLogs('marriage', marriage.id, marriageContext);
  } catch (err) { ElMessage.error('加载婚姻详情失败'); }
}

async function openRelationshipDetail(relData, personId, isParent = false) {
  try {
    let parentId, childId, parentName, childName, parentGender, childGender, parentPhoto, childPhoto;
    parentId = relData.relationship?.parent_id || relData.parent_id;
    childId = relData.relationship?.child_id || relData.child_id;
    if (!parentId || !childId) {
      if (isParent) { parentId = personId; childId = relData.id; }
      else { parentId = relData.id; childId = personId; }
    }
    const parentDetail = await personApi.detail(parentId);
    const childDetail = await personApi.detail(childId);
    parentName = parentDetail.name; childName = childDetail.name;
    parentGender = parentDetail.gender; childGender = childDetail.gender;
    parentPhoto = parentDetail.photo_url; childPhoto = childDetail.photo_url;
    currentRelationship.value = {
      id: relData.relationship_id || relData.id || parentId + '-' + childId,
      relationship_id: relData.relationship_id || relData.id,
      parent_id: parentId, child_id: childId,
      parent_name: parentName, child_name: childName,
      parent_gender: parentGender, child_gender: childGender,
      parent_photo: parentPhoto, child_photo: childPhoto,
      relationship_type: relData.relationship_type || '亲生'
    };
    relationshipDetailTab.value = 'evidence';
    relationshipDetailVisible.value = true;
    await loadContextEvidence('relationship', currentRelationship.value.id, relationshipContext);
    await loadContextChangeLogs('relationship', currentRelationship.value.id, relationshipContext);
  } catch (err) { console.error(err); ElMessage.error('加载关系详情失败'); }
}

async function loadContextEvidence(targetType, targetId, ctx) {
  try {
    const result = await evidenceApi.byTarget(targetType, targetId);
    ctx.evidence = result.data || [];
  } catch (err) { ctx.evidence = []; }
}
async function loadContextChangeLogs(targetType, targetId, ctx) {
  try {
    const result = await revisionApi.getChangeLogs(targetType, targetId);
    ctx.changeLogs = result.data || [];
  } catch (err) { ctx.changeLogs = []; }
}

function openEvidenceDialog(targetType, targetId) {
  evidenceTarget.type = targetType; evidenceTarget.id = targetId;
  resetEvidenceForm(); evidenceDialogVisible.value = true;
}
function resetEvidenceForm() {
  evidenceForm.evidence_type = ''; evidenceForm.source_title = ''; evidenceForm.source_url = '';
  evidenceForm.photo_date = ''; evidenceForm.credibility = 3; evidenceForm.notes = '';
  if (evidenceFormRef.value) evidenceFormRef.value.resetFields();
}
async function handleEvidenceSubmit() {
  if (!evidenceFormRef.value) return;
  await evidenceFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await evidenceApi.create({
          target_type: evidenceTarget.type, target_id: evidenceTarget.id, ...evidenceForm
        });
        ElMessage.success('证据上传成功'); evidenceDialogVisible.value = false;
        refreshContextForTarget(evidenceTarget.type, evidenceTarget.id);
      } catch (err) { ElMessage.error(err.response?.data?.error || '上传失败'); }
    }
  });
}
async function deleteEvidence(row, targetType, targetId) {
  try {
    await ElMessageBox.confirm('确定要删除该证据吗？', '删除确认', { type: 'warning' });
    await evidenceApi.delete(row.id);
    ElMessage.success('删除成功');
    refreshContextForTarget(targetType, targetId);
  } catch (err) { if (err !== 'cancel') ElMessage.error(err.response?.data?.error || '删除失败'); }
}

function refreshContextForTarget(targetType, targetId) {
  if (targetType === 'person') {
    loadContextEvidence('person', targetId, detailContext);
    loadContextChangeLogs('person', targetId, detailContext);
  } else if (targetType === 'marriage') {
    loadContextEvidence('marriage', targetId, marriageContext);
    loadContextChangeLogs('marriage', targetId, marriageContext);
  } else if (targetType === 'relationship') {
    loadContextEvidence('relationship', targetId, relationshipContext);
    loadContextChangeLogs('relationship', targetId, relationshipContext);
  }
}

function openRevisionDialog(targetType, data) {
  revisionTarget.type = targetType; revisionTarget.data = data;
  revisionForm.target_type = targetType;
  revisionForm.target_id = data.id;
  revisionForm.before_data = { ...data };
  revisionForm.after_data = { ...data };
  revisionForm.reason = '';
  revisionAfterJson.value = JSON.stringify(data, null, 2);
  conflictResult.checked = false; conflictResult.conflicts = [];
  revisionDialogVisible.value = true;
}
function resetRevisionForm() {
  revisionForm.target_id = null; revisionForm.before_data = {}; revisionForm.after_data = {};
  revisionForm.reason = ''; revisionAfterJson.value = '';
  conflictResult.checked = false; conflictResult.conflicts = [];
  if (revisionFormRef.value) revisionFormRef.value.resetFields();
}
async function checkConflicts() {
  try {
    let afterData;
    try { afterData = JSON.parse(revisionAfterJson.value); }
    catch (e) { ElMessage.error('JSON格式错误'); return; }
    const result = await revisionApi.detectConflicts({
      target_type: revisionForm.target_type,
      target_id: revisionForm.target_id, data: afterData
    });
    conflictResult.checked = true; conflictResult.conflicts = result.conflicts || [];
  } catch (err) { ElMessage.error(err.response?.data?.error || '冲突检测失败'); }
}
async function submitRevision() {
  if (!revisionFormRef.value) return;
  await revisionFormRef.value.validate(async (valid) => {
    if (valid) {
      let afterData;
      try { afterData = JSON.parse(revisionAfterJson.value); }
      catch (e) { ElMessage.error('JSON格式错误'); return; }
      try {
        await revisionApi.create({
          target_type: revisionForm.target_type, target_id: revisionForm.target_id,
          action: 'update', before_data: revisionForm.before_data, after_data: afterData,
          reason: revisionForm.reason, submitter: revisionForm.submitter, run_conflict_check: true
        });
        ElMessage.success('修订申请已提交，请等待审核'); revisionDialogVisible.value = false;
      } catch (err) { ElMessage.error(err.response?.data?.error || '提交失败'); }
    }
  });
}
async function handleRollback(log, targetType, targetData) {
  try {
    await ElMessageBox.confirm('确定要回滚到此版本吗？当前数据将被替换。', '回滚确认', { type: 'warning' });
    await revisionApi.rollback(log.id, { operator: '管理员' });
    ElMessage.success('回滚成功');
    refreshContextForTarget(targetType, targetData.id);
    loadData();
  } catch (err) { if (err !== 'cancel') ElMessage.error(err.response?.data?.error || '回滚失败'); }
}

function openAnniversaryDialog(row = null) {
  if (!currentPerson.value) return;
  isAnniversaryEdit.value = !!row;
  currentAnniversaryId.value = row?.id || null;
  resetAnniversaryForm();
  if (row) {
    Object.assign(anniversaryForm, row);
  } else {
    anniversaryForm.person_id = currentPerson.value.id;
  }
  anniversaryDialogVisible.value = true;
}

function resetAnniversaryForm() {
  anniversaryForm.person_id = currentPerson.value?.id || null;
  anniversaryForm.event_type = '';
  anniversaryForm.event_date = '';
  anniversaryForm.is_lunar = 0;
  anniversaryForm.repeat_rule = 'yearly';
  anniversaryForm.reminder_days = 7;
  anniversaryForm.notes = '';
  if (anniversaryFormRef.value) anniversaryFormRef.value.resetFields();
}

async function handleAnniversarySubmit() {
  if (!anniversaryFormRef.value) return;
  await anniversaryFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isAnniversaryEdit.value) {
          await anniversaryApi.update(currentAnniversaryId.value, anniversaryForm);
          ElMessage.success('更新成功');
        } else {
          await anniversaryApi.create(anniversaryForm);
          ElMessage.success('添加成功');
        }
        anniversaryDialogVisible.value = false;
        if (currentPerson.value) {
          await loadContextAnniversaries(currentPerson.value.id, detailContext);
        }
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '操作失败');
      }
    }
  });
}

async function deleteAnniversary(row) {
  try {
    await ElMessageBox.confirm(`确定要删除"${row.event_type}"吗？`, '删除确认', { type: 'warning' });
    await anniversaryApi.delete(row.id);
    ElMessage.success('删除成功');
    if (currentPerson.value) {
      await loadContextAnniversaries(currentPerson.value.id, detailContext);
    }
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.response?.data?.error || '删除失败');
  }
}
</script>

<style>
pre, .json-box {
  font-family: 'Courier New', monospace;
  margin: 0;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow: auto;
}
.json-box.before { background: #fef0f0; }
.json-box.after { background: #f0f9eb; }
</style>

<style scoped>
.clickable-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  min-width: 200px;
  position: relative;
  padding-right: 30px;
}
.clickable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.parent-card { background: #f5f7fa; }
.parent-card:hover { border-color: #409eff; }
.spouse-card { background: #fef0f0; }
.spouse-card:hover { border-color: #f56c6c; }
.child-card { background: #ecf5ff; }
.child-card:hover { border-color: #409eff; }
.card-arrow {
  position: absolute;
  right: 8px;
  color: #c0c4cc;
  font-size: 14px;
}
.clickable-card:hover .card-arrow {
  color: #409eff;
  transform: translateX(2px);
  transition: transform 0.2s;
}
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
  color: #dcdfe6;
}
</style>
