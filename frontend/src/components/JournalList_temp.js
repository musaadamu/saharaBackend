import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import './JournalList.css';

const JournalList = () => {
    const navigate = useNavigate();
    const [journals, setJournals] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalJournals: 0
    });

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            console.log('Fetching journals from:', api.defaults.baseURL);
            const response = await api.get('/journals', {
                params: { 
                    page, 
                    limit: 10,
                    sortBy: 'createdAt',
                    order: 'desc'
                }
            });

            console.log('API Response:', response.data);

            if (!response.data) {
                throw new Error('No data received from server');
            }

            const journalsData = response.data.journals || [];
            const paginationData = response.data.pagination || {
                currentPage: page,
                totalPages: 1,
                totalJournals: journalsData.length
            };

            setJournals(journalsData);
            setPagination(paginationData);
        } catch (err) {
            console.error('Fetch journals error:', err);
            let errorMsg = 'Failed to fetch journals';
            
            if (err.response) {
                errorMsg = err.response.data?.message || 
                         (err.response.status === 401 ? 'Please login to view journals' : 
                         err.response.status === 404 ? 'Journal endpoint not found' : 
                         'Server error occurred');
            } else if (err.request) {
                errorMsg = 'Network error - unable to reach server';
            } else {
                errorMsg = err.message || 'Error fetching journals';
            }

            setError(errorMsg);
            toast.error(errorMsg);

            if (err.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id, fileType) => {
        try {
            const response = await api.get(`/journals/${id}/download/${fileType}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const journal = journals.find(j => j._id === id);
            link.setAttribute('download', `${journal?.title || 'journal'}.${fileType}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(`Journal downloaded as ${fileType.toUpperCase()}`);
        } catch (err) {
            console.error('Download error:', err);
            toast.error(`Failed to download ${fileType.toUpperCase()} file`);
        }
    };

    if (loading) return <div className="loading-spinner">Loading journals...</div>;

    return (
        <div className="journal-list-container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="header flex flex-col sm:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0">Journal List</h2>
                <Link 
                    to="/journals/new" 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                    + New Journal
                </Link>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}

            {journals.length === 0 && !loading ? (
                <div className="text-center py-10 text-gray-500">
                    <p className="text-lg">No journals available</p>
                    <p className="mt-2">Start by creating a new journal!</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {journals.map((journal) => (
                            <div key={journal._id} className="journal-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                                <h3 
                                    className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                                    onClick={() => navigate(`/journals/${journal._id}`)}
                                >
                                    {journal.title || 'Untitled Journal'}
                                </h3>
                                <p className="text-gray-600 mt-2 line-clamp-2">
                                    {journal.abstract || 'No abstract available'}
                                </p>
                                <span className={`status mt-2 px-2 py-1 rounded-full text-xs ${
                                    journal.status === 'Published' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {journal.status || 'Draft'}
                                </span>
                                <div className="actions mt-4 flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => navigate(`/journals/${journal._id}`)} 
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        View
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(journal._id, 'pdf')} 
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        Download PDF
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(journal._id, 'docx')} 
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        Download DOCX
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {pagination.totalPages > 1 && (
                        <div className="pagination flex justify-between items-center mt-6">
                            <button 
                                onClick={() => fetchJournals(pagination.currentPage - 1)} 
                                disabled={pagination.currentPage === 1} 
                                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {pagination.currentPage} of {pagination.totalPages}
                            </span>
                            <button 
                                onClick={() => fetchJournals(pagination.currentPage + 1)} 
                                disabled={pagination.currentPage === pagination.totalPages} 
                                className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default JournalList;
