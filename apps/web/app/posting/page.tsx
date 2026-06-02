import { PostingReviewScreen } from '@/components/domain/posting/PostingReviewScreen';
export default function Page() { return <PostingReviewScreen packageId="rp-1" approvedStatus="approved" approvedPosting={[{ accountCode: '602', side: 'debit', amount: '200.00' }, { accountCode: '4531', side: 'debit', amount: '40.00' }, { accountCode: '401', side: 'credit', amount: '240.00' }]} />; }
