import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (existentProducts.length !== products.length) {
      throw new AppError('Products not found.');
    }

    const formattedProducts = products.map(product => {
      const foundExistentProducts = existentProducts.filter(
        foundExistentProduct => foundExistentProduct.id === product.id,
      );

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: foundExistentProducts[0].price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: formattedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
