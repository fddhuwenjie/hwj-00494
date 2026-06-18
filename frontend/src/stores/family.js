import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { personApi, queryApi, relationshipApi } from '@/api';

export const useFamilyStore = defineStore('family', () => {
  const persons = ref([]);
  const currentPerson = ref(null);
  const treeData = ref(null);
  const loading = ref(false);

  async function loadPersons(params = {}) {
    loading.value = true;
    try {
      const result = await personApi.list(params);
      persons.value = result.data || [];
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function loadTreeData() {
    loading.value = true;
    try {
      const result = await queryApi.treeData();
      treeData.value = result;
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function loadPersonDetail(id) {
    loading.value = true;
    try {
      const result = await personApi.detail(id);
      currentPerson.value = result;
      return result;
    } finally {
      loading.value = false;
    }
  }

  async function createPerson(data) {
    const result = await personApi.create(data);
    await loadPersons();
    return result;
  }

  async function updatePerson(id, data) {
    const result = await personApi.update(id, data);
    await loadPersons();
    return result;
  }

  async function deletePerson(id) {
    const result = await personApi.delete(id);
    await loadPersons();
    return result;
  }

  async function searchPersons(name) {
    const result = await personApi.search(name);
    return result;
  }

  async function addRelationship(type, data) {
    let result;
    switch (type) {
      case 'parent-child':
        result = await relationshipApi.addParentChild(data);
        break;
      case 'marriage':
        result = await relationshipApi.addMarriage(data);
        break;
      case 'sibling':
        result = await relationshipApi.addSibling(data);
        break;
      case 'child':
        result = await relationshipApi.addChild(data);
        break;
    }
    await loadTreeData();
    return result;
  }

  return {
    persons,
    currentPerson,
    treeData,
    loading,
    loadPersons,
    loadTreeData,
    loadPersonDetail,
    createPerson,
    updatePerson,
    deletePerson,
    searchPersons,
    addRelationship
  };
});
