import React from 'react';import {fireEvent,render,screen} from '@testing-library/react';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {expect,it,vi} from 'vitest';
import MenuManager from '../components/admin/MenuManager';
vi.mock('../lib/useSEO',()=>({useSEO:()=>{}}));
vi.mock('../components/admin/menu/CategoryList',()=>({CategoryList:()=>null}));vi.mock('../components/admin/menu/MenuItemList',()=>({MenuItemList:()=>null}));
vi.mock('../components/admin/MenuScanModal',()=>({default:({onDraft})=><button onClick={()=>onDraft?.({name:'QA 사진 초안'})}>사진 초안 선택</button>}));
vi.mock('../components/admin/ProductModal',()=>({ProductModal:({initialDraft})=><p>상품 등록 검토: {initialDraft?.name} / 매장 {initialDraft?.store_id}</p>}));
vi.mock('../hooks/useMenuManager',()=>({useMenuManager:()=>{
 const [showScanModal,setShowScanModal]=React.useState(true),[showProductModal,setShowProductModal]=React.useState(false),[editingProduct,setEditingProduct]=React.useState(null);
 return {store:{id:3,name:'QA'},categories:[],products:[],filteredProducts:[],selectedProducts:[],loading:false,showScanModal,setShowScanModal,showProductModal,setShowProductModal,editingProduct,setEditingProduct,fetchData:vi.fn()};
}}));
it('connects the actual scan modal to a new product review in the same store',async()=>{render(<MemoryRouter initialEntries={['/stores/3/menu']}><Routes><Route path="/stores/:storeId/menu" element={<MenuManager/>}/></Routes></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'사진 초안 선택'}));expect(await screen.findByText('상품 등록 검토: QA 사진 초안 / 매장 3')).toBeInTheDocument();});
