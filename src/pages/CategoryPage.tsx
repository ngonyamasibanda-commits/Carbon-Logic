import { Navigate, useParams } from 'react-router-dom'
import CategoryForm from '../components/form/CategoryForm'
import { getCategory } from '../lib/categories'

export default function CategoryPage() {
  const { categoryId } = useParams()
  const category = categoryId ? getCategory(categoryId) : undefined
  if (!category) return <Navigate to="/" replace />
  return <CategoryForm key={category.id} category={category} />
}
